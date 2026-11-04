import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';

test('application source contains no known double-decoded UI punctuation',()=>{
 const broken=/\u00c2[\u00b7\u00a9\u00a0]|\u00e2\u20ac[\u00a6\u201c\u201d\u2122]|\u00c3[\u00a9\u00b7]|\ufffd/;
 const failures:string[]=[];
 function scan(directory:string){
  for(const item of readdirSync(directory,{withFileTypes:true})){
   const path=join(directory,item.name);
   if(item.isDirectory())scan(path);
   else if(/\.(tsx?|css|html)$/.test(item.name)&&broken.test(readFileSync(path,'utf8')))failures.push(path);
  }
 }
 scan('src');
 assert.deepEqual(failures,[],'Fix encoded source literals rather than hiding them at render time');
});
