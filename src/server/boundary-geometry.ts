import GeoJSONReader from 'jsts/org/locationtech/jts/io/GeoJSONReader.js';
import GeometryFactory from 'jsts/org/locationtech/jts/geom/GeometryFactory.js';
import IsValidOp from 'jsts/org/locationtech/jts/operation/valid/IsValidOp.js';
import {boundaryLimits,boundaryPropertiesSchema,canonicalJson,type BoundaryCollection,type BoundaryFeature,type Geometry} from '../shared/boundaries';

function invalid(code:string):never {throw new Error(code)}
export function validateBoundaryCollection(input:unknown):{collection:BoundaryCollection;bboxes:number[][];positions:number} {
 const root=input as BoundaryCollection;
 if(!root||root.type!=='FeatureCollection'||!Array.isArray(root.features)||root.features.length<1||root.features.length>boundaryLimits.maxFeatures||Object.keys(root).some(k=>!['type','features'].includes(k)))invalid('INVALID_FEATURE_COLLECTION');
 const bboxes:number[][]=[],features:BoundaryFeature[]=[],identities=new Set<string>(),sourceIds=new Set<string>();let positions=0;
 for(const f of root.features){
  if(!f||f.type!=='Feature'||Object.keys(f).some(k=>!['type','properties','geometry'].includes(k)))invalid('INVALID_FEATURE');
  const p=boundaryPropertiesSchema.parse(f.properties),g=f.geometry as Geometry;
  if(identities.has(p.village.code)||sourceIds.has(p.source_id))invalid('DUPLICATE_BOUNDARY_IDENTITY');identities.add(p.village.code);sourceIds.add(p.source_id);
  if(new Set([p.province.code,p.regency.code,p.district.code,p.village.code]).size!==4)invalid('INVALID_ADMIN_HIERARCHY');
  if(!g||!['Polygon','MultiPolygon'].includes(g.type)||Object.keys(g).some(k=>!['type','coordinates'].includes(k))||!Array.isArray(g.coordinates))invalid('INVALID_GEOMETRY_TYPE');
  const polygons=g.type==='Polygon'?[g.coordinates as number[][][]]:g.coordinates as number[][][][];
  if(!polygons.length)invalid('EMPTY_GEOMETRY');let featurePositions=0;const bbox=[Infinity,Infinity,-Infinity,-Infinity];
  for(const polygon of polygons){
   if(!Array.isArray(polygon)||!polygon.length)invalid('EMPTY_POLYGON');
   for(const ring of polygon){
    if(!Array.isArray(ring)||ring.length<4)invalid('INVALID_LINEAR_RING');
    featurePositions+=ring.length;positions+=ring.length;
    if(positions>boundaryLimits.maxPositions||featurePositions>boundaryLimits.maxFeaturePositions)invalid('GEOMETRY_TOO_COMPLEX');
    for(const point of ring){
     if(!Array.isArray(point)||point.length!==2||!point.every(Number.isFinite)||point[0]<-180||point[0]>180||point[1]<-90||point[1]>90)invalid('INVALID_WGS84_POSITION');
     bbox[0]=Math.min(bbox[0],point[0]);bbox[1]=Math.min(bbox[1],point[1]);bbox[2]=Math.max(bbox[2],point[0]);bbox[3]=Math.max(bbox[3],point[1]);
    }
    if(ring[0][0]!==ring.at(-1)![0]||ring[0][1]!==ring.at(-1)![1])invalid('UNCLOSED_LINEAR_RING');
   }
  }
  // JTS topology validation covers self-intersections, nested holes and overlapping MultiPolygon components.
  const topology=new IsValidOp(new GeoJSONReader(new GeometryFactory()).read(g));
  if(!topology.isValid())invalid('INVALID_POLYGON_TOPOLOGY');
  bboxes.push([Math.floor(bbox[0]*1e7),Math.floor(bbox[1]*1e7),Math.ceil(bbox[2]*1e7),Math.ceil(bbox[3]*1e7)]);
  features.push({type:'Feature',properties:p,geometry:g});
 }
 const collection:BoundaryCollection={type:'FeatureCollection',features};
 if(new TextEncoder().encode(canonicalJson(collection)).byteLength>boundaryLimits.maxBytes)invalid('GEOMETRY_TOO_LARGE');
 return {collection,bboxes,positions};
}
