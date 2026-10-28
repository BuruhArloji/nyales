import {writeFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve,dirname,join} from 'node:path';
export function stagingConfig(env){
 const required=['CF_D1_DATABASE_ID','CF_ACCOUNT_ID','CF_R2_BUCKET','FIREBASE_PROJECT_ID','VITE_FIREBASE_PROJECT_ID','VITE_FIREBASE_API_KEY','VITE_FIREBASE_AUTH_DOMAIN'];
 for(const key of required)if(!env[key]?.trim())throw Error('MISSING_'+key);
 if(!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(env.CF_D1_DATABASE_ID)||/^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(env.CF_D1_DATABASE_ID))throw Error('CF_D1_DATABASE_ID_INVALID');
 if(!/^[0-9a-f]{32}$/i.test(env.CF_ACCOUNT_ID))throw Error('CF_ACCOUNT_ID_INVALID');
 if(!/^nyales-staging(?:-[a-z0-9]+)*$/.test(env.CF_R2_BUCKET))throw Error('STAGING_BUCKET_NAME_REQUIRED');
 if(!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(env.FIREBASE_PROJECT_ID))throw Error('FIREBASE_PROJECT_ID_INVALID');
 if(env.FIREBASE_PROJECT_ID!==env.VITE_FIREBASE_PROJECT_ID)throw Error('FIREBASE_PROJECT_MISMATCH');
 if(!/^[a-z0-9.-]+$/.test(env.VITE_FIREBASE_AUTH_DOMAIN)||!env.VITE_FIREBASE_AUTH_DOMAIN.includes('.'))throw Error('FIREBASE_AUTH_DOMAIN_INVALID');
 const firstAdmin=env.FIRST_ADMIN_EMAIL?.trim(),organization=env.FIRST_ADMIN_ORGANIZATION_NAME?.trim();
 if(Boolean(firstAdmin)!==Boolean(organization)||firstAdmin&&(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(firstAdmin)||firstAdmin.length>254||organization.length>120))throw Error('FIRST_ADMIN_CONFIG_INVALID');
 return {$schema:'node_modules/wrangler/config-schema.json',name:'nyales-staging',account_id:env.CF_ACCOUNT_ID,
  main:'dist/nyales/index.js',no_bundle:true,compatibility_date:'2026-10-17',compatibility_flags:['nodejs_compat'],
  // Cron disabled during initial staging bootstrap; enable after source/account capacity review.
  triggers:{crons:[]},observability:{enabled:true,head_sampling_rate:0.1},
  assets:{directory:'./dist/client',not_found_handling:'single-page-application',run_worker_first:['/api/*']},
  vars:{APP_ENV:'staging',LOCAL_AUTH:'false',FIREBASE_PROJECT_ID:env.FIREBASE_PROJECT_ID,...(firstAdmin?{FIRST_ADMIN_EMAIL:firstAdmin,FIRST_ADMIN_ORGANIZATION_NAME:organization}:{})},
  r2_buckets:[{binding:'IMPORT_FILES',bucket_name:env.CF_R2_BUCKET}],
  d1_databases:[{binding:'DB',database_name:'nyales-staging',database_id:env.CF_D1_DATABASE_ID,migrations_dir:'migrations'}]};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const config=stagingConfig(process.env),root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
 await writeFile(join(root,'wrangler.staging.generated.json'),JSON.stringify(config,null,2)+'\n',{flag:'w'});
 console.log(JSON.stringify({worker:config.name,local_auth:false,cron_enabled:false,config:'wrangler.staging.generated.json'}));
}
