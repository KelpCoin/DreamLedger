'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {allowedPublicRoute:ok}=require('../public/route-quarantine');
test('only owner-approved customer routes are visible during construction',()=>{
  for(const p of ['/', '/index.html','/mtg/','/mtg/community.html','/mtg/exchange.html',
     '/billboard.html','/avatar.html','/phinhaven/floor1.html','/ticker.html',
     '/login.html','/register.html','/account.html','/privacy.html','/terms.html',
     '/assets/dreamledger-mtg-theme.css','/data/mtg-catalog.json']){
    assert.equal(ok(p),true,'expected allowed: '+p);
  }
  for(const p of ['/agent-bridge.html','/agentic-commerce-remediation-blueprint.html',
     '/truth-oracle.html','/quote-compare-49.html','/pulse/index.html',
     '/b2b-marketplace.html','/residue.html','/economic','/random',
     '/tools/free.html','/marketplace.html','/silos/index.html']){
    assert.equal(ok(p),false,'must remain quarantined: '+p);
  }
});
test('render serves curated index and blocks unapproved routes',()=>{
  const server=fs.readFileSync(path.join(__dirname,'../public/server.js'),'utf8');
  assert.match(server,/allowedPublicRoute\(p\)/);
  assert.match(server,/X-Robots-Tag/);
  assert.match(server,/404,'DreamLedger: this page is under construction/);
  assert.match(server,/\x27\/\x27:\x27index.html\x27/);
  assert.match(server,/\/api\/billboard\/public/);
  assert.match(server,/\/api\/webhooks\/stripe/);
});
