import {createHash} from 'node:crypto';
import {copyFileSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {basename,join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';

function fail(message){throw new Error(message)}
function sha256(path){return createHash('sha256').update(readFileSync(path)).digest('hex')}

const [bundleArg,outputArg]=process.argv.slice(2);
if(!bundleArg||!outputArg)fail('Usage: node scripts/package-demo-staging.mjs <validated-bundle-dir> <new-output-dir>');
const bundle=resolve(bundleArg),output=resolve(outputArg);
const raw=JSON.parse(readFileSync(join(bundle,'manifest.json'),'utf8'));
if(raw.demo_classification!=='SYNTHETIC_AREA_OWNERSHIP'||raw.assignment?.is_synthetic!==true||raw.operational_status!=='DEMO_NOT_OPERATIONAL')fail('Refusing to package non-synthetic or operational assignment data');
if(raw.production_eligible!==false||raw.data_activation_authorized!==false||raw.d1_written!==false)fail('Refusing to package a production-eligible, activated, or D1-written dataset');
if(raw.tiles?.verified_by_pmtiles_cli!==true)fail('Refusing to package unverified PMTiles');
if(raw.tiles.sha256!==sha256(join(bundle,raw.tiles.path)))fail('PMTiles checksum mismatch');
const strategies=JSON.parse(raw.tiles.metadata?.strategies||'[]');
if(strategies.some(item=>item.dropped_as_needed))fail('Refusing to package PMTiles that drops source features due to tile limits');
const vectorLayers=raw.tiles.metadata?.vector_layers||[];
if(!vectorLayers.some(layer=>Object.hasOwn(layer.fields||{},'population_density_km2')))fail('PMTiles vector layer is missing population density values');
if(raw.source_validation.feature_count!==raw.geometry_validation.tile_feature_count)fail('Source and tile feature counts do not reconcile');
if(raw.assignment.assigned_code_count+raw.assignment.exception_feature_count!==raw.source_validation.feature_count)fail('Assignment plus review exceptions do not reconcile to source feature count');
const density=raw.population_density;
if(density?.field!=='population_density_km2'||density?.units!=='people/km²')fail('Population density metadata or units are missing');
if(density.valid_feature_count+density.missing_feature_count!==raw.source_validation.feature_count)fail('Population density counts do not reconcile to source features');
if(!Array.isArray(density.quantile_breaks)||density.quantile_breaks.length!==4||density.quantile_breaks.some((value,index)=>typeof value!=='number'||!Number.isFinite(value)||(index>0&&value<=density.quantile_breaks[index-1])))fail('Population density must have four increasing finite quintile breaks');
if(raw.r2_uploaded!==false)fail('Expected a local source bundle, not an already uploaded bundle');
const exceptionSource=join(bundle,'exceptions.csv'),exceptionText=readFileSync(exceptionSource,'utf8');
const exceptionLines=exceptionText.trimEnd().split(/\r?\n/);
if(exceptionLines.length!==raw.assignment.exception_issue_rows+1||!exceptionLines[0].replace(String.fromCharCode(0xFEFF),'').startsWith('exception_id,category,source_fid,'))fail('Exception CSV row count or schema does not match the manifest');
mkdirSync(output,{recursive:false});
const tiles=join(bundle,raw.tiles.path),publicTiles=join(output,'territories-demo.pmtiles');
copyFileSync(tiles,publicTiles);
copyFileSync(exceptionSource,join(output,'exceptions.csv'));
const areaSummary=JSON.parse(readFileSync(join(bundle,'area-summary.json'),'utf8'));
writeFileSync(join(output,'area-summary.json'),JSON.stringify(areaSummary));
const publicManifest={
 title:'NYALES Area Territory Management — portfolio demo',
 demo_classification:raw.demo_classification,
 operational_status:raw.operational_status,
 production_eligible:false,
 boundary_source:{label:raw.boundary_source.label,record:raw.boundary_source.record,service:raw.boundary_source.service,reuse_rights_status:raw.boundary_source.reuse_rights_status},
 population_source:{label:raw.population_source.label,stac_item:raw.population_source.stac_item,recommended_doi:raw.population_source.recommended_doi,caveat:raw.population_source.caveat},
 source_validation:{feature_count:raw.source_validation.feature_count,pum_unique_code_count:raw.source_validation.pum_unique_code_count,pum_missing_feature_count:raw.source_validation.pum_missing_feature_count,pum_duplicate_code_count:raw.source_validation.pum_duplicate_code_count},
 geometry_validation:{valid_geometry_count:raw.geometry_validation.valid_geometry_count},
 assignment:{is_synthetic:true,basis:raw.assignment.basis,effective_from:raw.assignment.effective_from,assigned_code_count:raw.assignment.assigned_code_count,exception_feature_count:raw.assignment.exception_feature_count,exception_issue_rows:raw.assignment.exception_issue_rows},
 population_density:density,
 exception_list:{file:'exceptions.csv',feature_count:raw.assignment.exception_feature_count,issue_rows:raw.assignment.exception_issue_rows},
 area_summary:areaSummary,
 tiles:{verified_by_pmtiles_cli:true,maxzoom:raw.tiles.maxzoom,size_bytes:raw.tiles.size_bytes,maximum_tile_bytes:raw.tiles.maximum_tile_bytes,sha256:raw.tiles.sha256},
 limitations:raw.limitations,
};
writeFileSync(join(output,'manifest.json'),JSON.stringify(publicManifest,null,2)+'\n');
const artifacts={};
for(const name of ['territories-demo.pmtiles','manifest.json','area-summary.json','exceptions.csv'])artifacts[name]={size_bytes:readFileSync(join(output,name)).byteLength,sha256:sha256(join(output,name))};
writeFileSync(join(output,'PACKAGE_CHECKSUMS.json'),JSON.stringify({classification:'SYNTHETIC_PORTFOLIO_DEMO',artifacts},null,2)+'\n');
const tarPath=`${output}.tar.gz`;
execFileSync('tar',['-czf',tarPath,'-C',output,'territories-demo.pmtiles','manifest.json','area-summary.json','exceptions.csv','PACKAGE_CHECKSUMS.json'],{stdio:'inherit'});
console.log(JSON.stringify({status:'ready_for_staging_upload',output,archive:tarPath,feature_count:raw.source_validation.feature_count,assigned_synthetic:raw.assignment.assigned_code_count,exceptions:raw.assignment.exception_feature_count,exception_issue_rows:raw.assignment.exception_issue_rows,pmtiles_bytes:raw.tiles.size_bytes,pmtiles_sha256:raw.tiles.sha256,package_bytes:readFileSync(tarPath).byteLength,public_manifest_basename:basename(join(output,'manifest.json')),no_d1_write:true,not_activated:true,production_eligible:false},null,2));
