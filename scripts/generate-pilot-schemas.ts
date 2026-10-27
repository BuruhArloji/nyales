import {writeFileSync} from 'node:fs';
import {z} from 'zod';
import {pilotManifest,pilotSnapshot,pilotIdMapping} from '../src/shared/pilot';
for(const [name,schema] of [['manifest',pilotManifest],['snapshot',pilotSnapshot],['id-mapping',pilotIdMapping]] as const){writeFileSync('docs/specifications/pilot-'+name+'.schema.json',JSON.stringify(z.toJSONSchema(schema),null,2)+'\n');}
console.log('Generated three pilot JSON schemas; no API or database changes.');
