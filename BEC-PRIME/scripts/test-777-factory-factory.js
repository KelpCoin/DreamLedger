'use strict';

const assert = require('node:assert/strict');
const { buildFactoryTemplates, buildFactoryInstances, buildFactoryFactory } = require('./FactoryFactory');

const adapters = [
  { slug: 'construction-quotes', name: 'Construction Quotes', fulfillment: 'SUPPLIER_QUOTE_COMPARISON', checkout_url: '/pay' },
  { slug: 'it-hardware-quotes', name: 'IT Hardware Quotes', fulfillment: 'SUPPLIER_QUOTE_COMPARISON', checkout_url: '/pay' }
];

const templates = buildFactoryTemplates(adapters);
assert.equal(templates.length, 2);
assert.ok(templates.every(x => x.variant_batch_size >= 5 && x.variant_batch_size <= 10));
assert.ok(templates.every(x => x.authority === 'ALLOCATION_ONLY'));
assert.ok(templates.every(x => x.replication_gate === 'FORBIDDEN_UNTIL_INDEPENDENT_VERIFIED_OUTCOME'));

const groups = buildFactoryInstances(templates, { opportunity_id: 'SEED-001' });
const ids = groups.flatMap(x => x.instances.map(y => y.factory_instance_id));
assert.equal(ids.length, 10);
assert.equal(new Set(ids).size, ids.length);
assert.ok(groups.every(x => x.instances.every(y => y.external_action === 'BLOCKED')));
assert.ok(groups.every(x => x.instances.every(y => y.replication_permission === false)));

const factory = buildFactoryFactory(adapters, { opportunity_id: 'SEED-001' });
assert.equal(factory.template_count, 2);
assert.equal(factory.factory_instance_count, 10);
assert.equal(factory.truth.verified_external_revenue_nzd, 0);
assert.equal(factory.replication, 'FORBIDDEN_UNTIL_INDEPENDENT_VERIFIED_OUTCOME');

console.log('777_FACTORY_FACTORY_TEST=PASS');
