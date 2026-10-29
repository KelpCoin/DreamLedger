'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const file = path.join(__dirname, '..', 'routes', 'distributionDoorway.js');
const route = fs.readFileSync(file, 'utf8');
for (const clause of [
  "q.get('utm_source')",
  "q.get('utm_medium')",
  "q.get('utm_campaign')",
  "q.get('utm_term')",
  "q.get('utm_content')",
  "target.searchParams.set('utm_source', source)",
  "target.searchParams.set('utm_medium', medium)",
  "target.searchParams.set('utm_campaign', campaign)",
  "target.searchParams.set('utm_term', term)",
  "target.searchParams.set('utm_content', content)",
  "target.searchParams.set('acquisition_id', sessionId)",
  "recordDoorwaySession",
  "ledger.appendEvent"
]) assert.ok(route.includes(clause), 'Missing /go lineage: ' + clause);
assert.ok(route.includes('302'), 'Expected non-permanent redirect');
console.log('PASS: existing /go forwards source, medium, campaign, term, content and session lineage');
