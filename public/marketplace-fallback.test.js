'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname,'server.js'),'utf8');

test('marketplace has a local public page fallback', () => {
  assert.match(source,/p==='\/marketplace'/);
  assert.match(source,/serveFile\(res,'cube-marketplace\.html'\)/);
});

test('cube marketplace APIs are locally available', () => {
  assert.match(source,/p==='\/api\/cube\/silos'/);
  assert.match(source,/p==='\/api\/cube\/marketplace'/);
  assert.match(source,/function localCubeMarketplace/);
});
