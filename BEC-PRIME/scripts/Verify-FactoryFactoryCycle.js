'use strict';

const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'data', 'factory-factory', 'FACTORY-FACTORY-CYCLE.json');
if (!fs.existsSync(file)) throw new Error('Factory-Factory cycle evidence missing');

const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
if (doc.schema_version !== 'DREAMLEDGER/FACTORY-FACTORY-CYCLE/v1') throw new Error('schema mismatch');
if (!Number.isInteger(doc.selected_count) || doc.selected_count < 0) throw new Error('invalid selected_count');
if (doc.external_action !== 'NOT_PERFORMED') throw new Error('external action boundary violated');
if (doc.external_revenue !== 'UNVERIFIED') throw new Error('revenue boundary violated');
if (doc.business_truth !== 'NOT_CLAIMED') throw new Error('truth boundary violated');
console.log(JSON.stringify({
  status: 'PASS',
  selected_count: doc.selected_count,
  external_action: doc.external_action,
  external_revenue: doc.external_revenue,
  business_truth: doc.business_truth
}, null, 2));
