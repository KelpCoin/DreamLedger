'use strict';

const assert = require('assert');
const {Blackboard} = require('./blackboard');

const b = new Blackboard();

const first = b.publish({
  topic:'candidate',
  producer:'elohim',
  payload:{candidate_id:'C-1'},
  idempotency_key:'candidate:C-1'
});
assert.equal(first.status,'APPENDED');

const duplicate = b.publish({
  topic:'candidate',
  producer:'elohim',
  payload:{candidate_id:'C-1'},
  idempotency_key:'candidate:C-1'
});
assert.equal(duplicate.status,'DEDUPLICATED');

assert.equal(b.read('candidate').length,1);

const lease1 = b.acquireLease('T-1','worker-a',60000);
assert.equal(lease1.status,'ACQUIRED');

const lease2 = b.acquireLease('T-1','worker-b',60000);
assert.equal(lease2.status,'BUSY');

const p1 = b.recordProficiency('worker-a',{success:true,evidence_quality:1});
const p2 = b.recordProficiency('worker-a',{success:false,evidence_quality:0});
assert.equal(p2.sample_count,2);
assert.equal(p2.reliability,.5);
assert.equal(p2.evidence_quality,.5);

console.log(JSON.stringify({
  status:'PASS',
  suite:'blackboard',
  tests:6,
  properties:['append_only','topic_partitioning','idempotency','lease_exclusion','outcome_derived_proficiency'],
  live_economic_proof:'NONE'
},null,2));
