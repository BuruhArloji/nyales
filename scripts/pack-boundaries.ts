import {readFileSync,writeFileSync} from 'node:fs';
import {boundaryLimits,boundaryDatasetSchema,canonicalJson,manifestJson} from '../src/shared/boundaries';
import {validateBoundaryCollection} from '../src/server/boundary-geometry';
import {digest} from '../src/server/operations';

const [input,output]=process.argv.slice(2);if(!input||!output)throw Error('Usage: tsx scripts/pack-boundaries.ts input.json NEW-package.json');
const source=JSON.parse(readFileSync(input,'utf8'));
if(!Array.isArray(source.chunks)||source.chunks.length<1||source.chunks.length>boundaryLimits.maxChunks)throw Error('Invalid chunk count');
const checksums:string[]=[],identities=new Set<string>();let count=0,totalBytes=0;
for(const chunk of source.chunks){const {collection}=validateBoundaryCollection(chunk);for(const f of collection.features){if(identities.has(f.properties.village.code))throw Error('Duplicate village across chunks');identities.add(f.properties.village.code)}const body=canonicalJson(collection);checksums.push(await digest(body));count+=collection.features.length;totalBytes+=new TextEncoder().encode(body).byteLength}
if(totalBytes>boundaryLimits.maxDatasetBytes)throw Error('Dataset exceeds configured source-byte budget');
const dataset=boundaryDatasetSchema.parse({...source.dataset,expected_features:count,expected_chunks:source.chunks.length,manifest_sha256:await digest(manifestJson(checksums))});
writeFileSync(output,canonicalJson({format:'nyales-boundary-package-1',dataset,chunks:source.chunks})+'\n',{flag:'wx'});
console.log(JSON.stringify({file:output,features:count,chunks:checksums.length,geometry_bytes:totalBytes,manifest_sha256:dataset.manifest_sha256,status:'validated package; not imported or activated'}));
