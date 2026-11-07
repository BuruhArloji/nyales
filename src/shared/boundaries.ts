import {z} from 'zod';

export const boundaryLimits={maxBytes:1536*1024,maxDatasetBytes:64*1024*1024,maxFeatures:32,maxPositions:40000,maxFeaturePositions:20000,maxDatasetFeatures:5000,maxChunks:100} as const;
const text=z.string().trim().min(1).max(250),code=z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/),sha=z.string().regex(/^[a-f0-9]{64}$/);
const https=z.url().refine(v=>new URL(v).protocol==='https:','Gunakan referensi HTTPS');
export const boundaryDatasetSchema=z.object({
 provider:text,code_namespace:code,release_version:text,released_at:z.iso.date().nullable(),acquired_at:z.iso.datetime(),source_reference:https,
 source_checksum:sha,metadata:z.object({reference_release:text,origin:text,code_mapping:text,usage_terms_status:z.enum(['unverified','documented']),notes:z.string().max(4000)}).strict(),
 coverage:z.object({label:text,source_filter:z.string().min(1).max(500),national_complete:z.literal(false)}).strict(),
 manifest_sha256:sha,expected_features:z.number().int().min(1).max(boundaryLimits.maxDatasetFeatures),expected_chunks:z.number().int().min(1).max(boundaryLimits.maxChunks)
}).strict();
export const boundaryReviewSchema=z.object({reason:z.string().trim().min(8).max(1000),license_reference:https,license_note:z.string().trim().min(12).max(2000),attribution:z.string().trim().min(8).max(1000),confirm_usage_rights:z.literal(true),expected_active_id:z.string().min(1).max(128).nullable()}).strict();
const unit=z.object({code,name:text}).strict();
export const boundaryPropertiesSchema=z.object({source_id:z.string().min(1).max(128),province:unit,regency:unit,district:unit,village:z.object({code,name:text,type:z.enum(['desa','kelurahan'])}).strict()}).strict();
export type BoundaryProperties=z.infer<typeof boundaryPropertiesSchema>;
export type BoundaryDatasetInput=z.infer<typeof boundaryDatasetSchema>;
export type Geometry={type:'Polygon'|'MultiPolygon';coordinates:number[][][]|number[][][][]};
export type BoundaryFeature={type:'Feature';properties:BoundaryProperties;geometry:Geometry};
export type BoundaryCollection={type:'FeatureCollection';features:BoundaryFeature[]};
// Canonical serialization is shared by acquisition tools, client and server manifests.
export function canonicalJson(value:unknown):string {
 if(value===null||typeof value!=='object')return JSON.stringify(value);
 if(Array.isArray(value))return '['+value.map(canonicalJson).join(',')+']';
 const obj=value as Record<string,unknown>;return '{'+Object.keys(obj).sort().map(k=>JSON.stringify(k)+':'+canonicalJson(obj[k])).join(',')+'}';
}
export function manifestJson(checksums:string[]){return canonicalJson(checksums.map((checksum,index)=>({index,checksum})))}

export const boundarySelectionSchema=z.object({enabled:z.boolean(),expected_active_id:z.string().min(1).max(128).nullable()}).strict();
