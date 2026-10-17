'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const server = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');

test('storefront version endpoint reports the actual deployed commit', () => {
  assert.match(
    server,
    /if\(req\.method==='GET'&&p==='\/version'\)\s*\{\s*return send\(res,200,JSON\.stringify\(\{service:'dreamledger-storefront',status:'ok',mtg:'master',commit:COMMIT\}\)/
  );
});

test('storefront deployment identity comes from Render or the CI commit environment', () => {
  assert.match(server, /const COMMIT=process\.env\.RENDER_GIT_COMMIT\|\|process\.env\.RENDER_GIT_COMMIT_SHA\|\|process\.env\.GITHUB_SHA\|\|'unknown'/);
});
