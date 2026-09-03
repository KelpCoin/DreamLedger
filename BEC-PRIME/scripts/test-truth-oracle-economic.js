'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const oracle = require('../runtime/TruthOracle');

test('Truth Oracle exposes the required evidence taxonomy', () => {
  assert.deepEqual(oracle.EVIDENCE_TYPES, [
    'OBSERVED','INDEPENDENTLY_VERIFIED','SOURCE_SUPPORT','DERIVED','INFERRED','CONTRADICTED','UNKNOWN'
  ]);
});

test('confidence calculation is deterministic and freshness bounded', () => {
  const now = Date.parse('2026-09-03T00:00:00Z');
  const evidence = [
    {type:'OBSERVED',timestamp:'2026-09-03T00:00:00Z'},
    {type:'INDEPENDENTLY_VERIFIED',timestamp:'2026-06-03T00:00:00Z'},
    {type:'SOURCE_SUPPORT',timestamp:'2025-09-03T00:00:00Z'},
    {type:'CONTRADICTED',timestamp:'2026-09-03T00:00:00Z'}
  ];
  const a = oracle.confidenceScore(evidence, 0, now);
  const b = oracle.confidenceScore(evidence, 0, now);
  assert.equal(a,b);
  assert.ok(a >= 0 && a <= 100);
});

test('unknown evidence and unresolved items reduce certainty without changing truth inputs', () => {
  const now = Date.parse('2026-09-03T00:00:00Z');
  const evidence = [{type:'UNKNOWN',timestamp:'2026-09-03T00:00:00Z'}];
  const noUnresolved = oracle.confidenceScore(evidence,0,now);
  const unresolved = oracle.confidenceScore(evidence,2,now);
  assert.ok(unresolved < noUnresolved);
});

test('confidence bands cover the full public range', () => {
  assert.equal(oracle.confidenceBand(0),'VERY LOW');
  assert.equal(oracle.confidenceBand(20),'VERY LOW');
  assert.equal(oracle.confidenceBand(21),'LOW');
  assert.equal(oracle.confidenceBand(40),'LOW');
  assert.equal(oracle.confidenceBand(41),'MODERATE');
  assert.equal(oracle.confidenceBand(60),'MODERATE');
  assert.equal(oracle.confidenceBand(61),'HIGH');
  assert.equal(oracle.confidenceBand(80),'HIGH');
  assert.equal(oracle.confidenceBand(81),'VERY HIGH');
  assert.equal(oracle.confidenceBand(100),'VERY HIGH');
});
