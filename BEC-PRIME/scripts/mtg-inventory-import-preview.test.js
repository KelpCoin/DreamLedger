'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseCsv, prepare } = require('./mtg-inventory-import-preview');

test('CSV supports quoted names, escaped quotes and newlines', () => {
  const records = parseCsv('Name,Set Code,Collector Number,Quantity,Foil\n"A ""quoted"", card",m10,123,1,No\n"Two\nlines",m10,124,1,Yes\n');
  assert.equal(records.length, 2);
  assert.equal(records[0].name, 'A "quoted", card');
  assert.equal(records[1].name, 'Two\nlines');
});

test('same file is idempotent and physical state stays unverified', () => {
  const csv = 'Card Name,Set Code,Collector Number,Quantity,Foil,Condition,Language,Location,Price NZD\n' +
    'Ponder,m10,77,2,No,Near Mint,en,Box A,5\n' +
    'Ponder,m10,77,2,No,Near Mint,en,Box A,5\n' +
    'Ponder,m10,77,1,Yes,Near Mint,en,Box A,9\n' +
    'Ponder,m10,77,1,No,Lightly Played,en,Box A,4\n' +
    'Ponder,m10,77,1,No,Near Mint,en,Box B,5\n';
  const a = prepare(csv, {source_name:'manabox.csv'});
  const b = prepare(csv, {source_name:'manabox.csv'});
  assert.equal(a.import_sha256, b.import_sha256);
  assert.deepEqual(a.records, b.records);
  assert.equal(a.source_rows, 5);
  assert.equal(a.accepted, 4);
  assert.equal(a.duplicate_rows, 1);
  assert.equal(a.quarantined, 0);
  assert.equal(a.physical_verified_count, 0);
  assert.equal(a.public_listing_count, 0);
  assert.equal(a.realized_cash_nzd, null);
  assert.equal(a.records.every(x => x.verification_state === 'UNVERIFIED' && x.expected_net_cash_nzd === null), true);
  assert.equal(a.next_actions[0].ready_to_publish, false);
  assert.equal(a.next_actions[0].priority_reference_gross_nzd, 10);
  assert.equal(new Set(a.records.map(x => x.candidate_id)).size, 4);
});

test('negative inventory, ambiguous printing and missing finish are quarantined', () => {
  const csv = 'Card Name,Set Code,Collector Number,Quantity,Foil,Condition\n' +
    'No qty,m10,50,-2,No,NM\n' +
    'Unknown print,,,1,No,NM\n' +
    'Valid,m10,51,1,No,NM\n';
  const a = prepare(csv);
  assert.equal(a.accepted, 1);
  assert.equal(a.quarantined, 2);
  assert.equal(a.quarantine.some(x => x.reasons.includes('INVALID_QUANTITY')), true);
  assert.equal(a.quarantine.some(x => x.reasons.includes('PRINTING_AMBIGUOUS')), true);
  const missingFinish = prepare('Name,Set Code,Collector Number,Quantity\nValid,m10,60,1\n');
  assert.equal(missingFinish.accepted, 0);
  assert.equal(missingFinish.quarantine[0].reasons.includes('FINISH_AMBIGUOUS'), true);
});

test('Scryfall ID alone may stage a candidate but cannot verify physical stock', () => {
  const a = prepare('Name,Scryfall ID,Quantity,Foil\nPonder,aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee,1,Yes\n');
  assert.equal(a.accepted, 1);
  assert.equal(a.records[0].scryfall_metadata_verified, false);
  assert.equal(a.records[0].publication_approved, false);
});

test('invalid CSV cannot silently import a partial record', () => {
  assert.throws(() => parseCsv('Name,Quantity\n"unclosed,1'), /Unclosed CSV/);
  const a = prepare('Name,Set Code,Collector Number,Quantity,Foil\nPonder,m10,60,1,No,extra\n');
  assert.equal(a.accepted, 0);
  assert.equal(a.quarantined, 1);
  assert.equal(a.quarantine[0].reasons.includes('COLUMN_COUNT_MISMATCH'), true);
});
