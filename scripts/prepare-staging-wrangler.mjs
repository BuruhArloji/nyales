import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const required=['CF_D1_DATABASE_ID','CF_ACCOUNT_ID','CF_R2_BUCKET'];
for(const key of required)if(!process.env[key])throw new Error(`Missing ${key}`);
if(!/^[0-9a-f-]{36}$/i.test(process.env.CF_D1_DATABASE_ID))throw new Error('CF_D1_DATABASE_ID_INVALID');
if(!/^[0-9a-f]{32}$/i.test(process.env.CF_ACCOUNT_ID))throw new Error('CF_ACCOUNT_ID_INVALID');
if(!/^[a-z0-9][a-z0-9._-]{2,62}$/.test(process.env.CF_R2_BUCKET))throw new Error('CF_R2_BUCKET_INVALID');
const config={"$schema":"node_modules/wrangler/config-schema.json",name:"nyales-staging",main:"src/server/index.ts",compatibility_date:"2026-10-17",triggers:{crons:["10 * * * *"]},observability:{enabled:true,head_sampling_rate:0.1},compatibility_flags:["nodejs_compat"],assets:{directory:"./dist/client",not_found_handling:"single-page-application",run_worker_first:["/api/*"]},vars:{APP_ENV:"staging",LOCAL_AUTH:"false",FIREBASE_PROJECT_ID:process.env.FIREBASE_PROJECT_ID||""},r2_buckets:[{binding:"IMPORT_FILES",bucket_name:process.env.CF_R2_BUCKET}],d1_databases:[{binding:"DB",database_name:"nyales-staging",database_id:process.env.CF_D1_DATABASE_ID,migrations_dir:"migrations"}]};
await mkdir(resolve('.github/.generated'),{recursive:true});await writeFile(resolve('.github/.generated/wrangler.staging.json'),JSON.stringify(config,null,2)+'\n',{flag:'w'});console.log(JSON.stringify({name:config.name,account_id_bound:true,d1_database_id_bound:true,r2_bucket:config.r2_buckets[0].bucket_name,local_auth:false}));
