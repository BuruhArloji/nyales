import {parseArgs} from 'node:util';
import {runDailyFiles} from '../src/agent/daily-files';
const {values}=parseArgs({options:{snapshot:{type:'string'},policy:{type:'string'},installation:{type:'string'},
 'graph-directory':{type:'string'},python:{type:'string'},'osrm-origin':{type:'string'},output:{type:'string'}},strict:true});
const required=['snapshot','policy','installation','graph-directory','python','osrm-origin','output'] as const;
if(required.some(name=>!values[name])){console.error('Usage: visit:daily -- --snapshot FILE --policy FILE --installation FILE --graph-directory DIR --python EXECUTABLE --osrm-origin http://127.0.0.1:PORT --output NEW_FILE');process.exitCode=2}
else{
 const controller=new AbortController(),stop=()=>controller.abort();process.once('SIGINT',stop);process.once('SIGTERM',stop);
 try{console.log(JSON.stringify(await runDailyFiles({snapshot:values.snapshot!,policy:values.policy!,installation:values.installation!,
  graphDirectory:values['graph-directory']!,python:values.python!,osrmOrigin:values['osrm-origin']!,output:values.output!,signal:controller.signal})))}
 catch(error){console.error(error instanceof Error&&/^[A-Z][A-Z0-9_]+$/.test(error.message)?error.message:'DAILY_INPUT_OR_RUNTIME_FAILED');process.exitCode=1}
 finally{process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop)}
}
