import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {WorkOutbox} from '../src/client/Work';

test('empty and synced queues do not produce explanatory boxes',()=>{
 for(const pending of [[],[{id:'done',status:'synced'}]]){
  assert.equal(renderToStaticMarkup(createElement(WorkOutbox,{work:{pending,busy:false,message:'Antrean sinkronisasi diperiksa.'} as any})), '');
 }
});
test('pending data has a sync action and conflicts remain visible without a zero-event button',()=>{
 const render=(pending:any[])=>renderToStaticMarkup(createElement(WorkOutbox,{work:{pending,busy:false,sync:async()=>{}} as any}));
 const queued=render([{id:'one',status:'pending',type:'activity'}]);
 assert.match(queued,/1 data menunggu dikirim/);assert.match(queued,/Sinkronkan/);assert.doesNotMatch(queued,/0 event|penyimpanan browser/);
 const conflict=render([{id:'conflict',type:'activity',status:'review',result:{code:'VERSION_CONFLICT'}}]);
 assert.match(conflict,/Data perlu ditinjau/);assert.match(conflict,/VERSION_CONFLICT/);assert.doesNotMatch(conflict,/Sinkronkan/);
});
