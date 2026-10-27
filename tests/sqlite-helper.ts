import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
export function database(through='9999'){
 const sqlite=new DatabaseSync(':memory:');
 for(const name of readdirSync('migrations').filter(name=>name.slice(0,4)<=through).sort())sqlite.exec(readFileSync('migrations/'+name,'utf8'));
 const adapter={batch:async(statements:any[])=>{sqlite.exec('BEGIN');try{const results=statements.map(s=>s.run());sqlite.exec('COMMIT');return results}catch(e){sqlite.exec('ROLLBACK');throw e}},prepare:(sql:string)=>{let params:unknown[]=[];const statement={run:()=>sqlite.prepare(sql).run(...params as any),bind:(...p:unknown[])=>{params=p;return statement},all:async()=>({results:sqlite.prepare(sql).all(...params as any)}),first:async()=>sqlite.prepare(sql).get(...params as any)||null};return statement}} as unknown as D1Database;
 return {sqlite,adapter};
}
