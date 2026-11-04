import {test} from 'node:test';
import assert from 'node:assert/strict';
import {presentationLabel,invoiceLabel} from '../src/shared/business-labels';

test('visible labels drop simulation markers without changing source identifiers or real names',()=>{
 const record={name:'Kota Bekasi · DEMO',id:'beverage-demo-v1-sale-101'};
 assert.equal(presentationLabel(record.name),'Kota Bekasi');
 assert.equal(presentationLabel('Bekasi · DEMO · target field Agu 2026'),'Bekasi target field Agu 2026');
 assert.equal(presentationLabel('Supervisor DEMO Bekasi'),'Supervisor Bekasi');
 assert.equal(presentationLabel('Demografi Kelurahan'),'Demografi Kelurahan');
 assert.equal(presentationLabel('Didik Priyo Utomo'),'Didik Priyo Utomo');
 assert.equal(record.name,'Kota Bekasi · DEMO');assert.equal(record.id,'beverage-demo-v1-sale-101');
 assert.equal(invoiceLabel(record.id),'INV/2611/000101');
});
