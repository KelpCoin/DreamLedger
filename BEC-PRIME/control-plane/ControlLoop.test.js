'use strict';
const assert = require('assert');
const { stableId, ORACLE_SCHEMA, GAUNTLET_SCHEMA } = require('./ControlLoop');

const proposal = 'Add a healing item to Kelplantis Floor 1.';
assert.strictEqual(stableId(proposal), stableId(proposal));
assert.notStrictEqual(stableId(proposal), stableId(proposal + 'x'));
assert.deepStrictEqual(ORACLE_SCHEMA.required, ['verdict','confidence','claims','missing_evidence','sources','reasoning']);
assert.deepStrictEqual(GAUNTLET_SCHEMA.required, ['verdict','confidence','attacks','economic_risks','operational_risks','recommended_action']);
console.log('ControlLoop contract tests: PASS');
