'use strict';
const assert=require('node:assert/strict');
const {buildModularFactories}=require('../compiler/FactoryFactory');

const adapters=[
 {slug:'construction-quotes',fulfillment:'SUPPLIER_QUOTE_COMPARISON'},
 {slug:'it-hardware-quotes',fulfillment:'SUPPLIER_QUOTE_COMPARISON'}
];
const factories=buildModularFactories(adapters,'SEED-001');
assert.equal(factories.length,2);
assert.ok(factories.every(x=>x.instances.length>=5&&x.instances.length<=10));
const ids=factories.flatMap(x=>x.instances.map(i=>i.factory_instance_id));
assert.equal(new Set(ids).size,ids.length);
assert.ok(factories.every(x=>x.instances.every(i=>i.external_action==='BLOCKED')));
assert.ok(factories.every(x=>x.instances.every(i=>i.replication_permission===false)));
assert.ok(factories.every(x=>x.instances.every(i=>i.truth_status==='UNVERIFIED')));
console.log('777_FACTORY_FACTORY_TEST=PASS');
