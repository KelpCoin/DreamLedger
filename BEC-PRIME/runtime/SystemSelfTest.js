'use strict';

const assert = require('assert');
const CubePinball = require('./CubePinball');

assert.strictEqual(CubePinball.parseJson('{"ok":true}').ok, true);
const seed = CubePinball.safeSeed(
  {title:'self-test',problem:'bounded problem',target_buyer:'identified buyer'},
  {silo_id:'SELFTEST'}
);
assert(seed);
assert.strictEqual(seed.silo_id,'SELFTEST');

console.log(JSON.stringify({
  status:'PASS',
  tests:['pinball_json_parser','pinball_seed_builder']
},null,2));
