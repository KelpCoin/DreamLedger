"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const root=__dirname;
const read=n=>fs.readFileSync(path.join(root,n),"utf8");
const cube=read("cube-marketplace.html");
const auctions=read("auctions.html");
const dispatcher=fs.readFileSync(path.join(root,"../api/[...route].ts"),"utf8");
const silos=fs.readFileSync(path.join(root,"../handlers/cube/silos.js"),"utf8");
const market=fs.readFileSync(path.join(root,"../handlers/cube/marketplace.js"),"utf8");
const scripts=s=>[...s.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).filter(Boolean);

test("marketplace uses existing allowlisted handler routes",()=>{
 assert.match(cube,/fetch\("\/api\/cube\/silos"/);
 assert.match(cube,/fetch\("\/api\/cube\/marketplace"/);
 assert.match(dispatcher,/"\/api\/cube\/silos"/);
 assert.match(dispatcher,/"\/api\/cube\/marketplace"/);
 assert.match(silos,/schema:'CUBE\/SILO-REGISTRY\/v1'/);
 assert.match(market,/schema:'CUBE\/B2B-MARKETPLACE\/v1'/);
});
test("marketplace uses safe DOM text rather than untrusted HTML interpolation",()=>{
 assert.match(cube,/\.textContent = String\(value\)/);
 assert.doesNotMatch(cube,/\.innerHTML/);
 assert.match(cube,/localRoute/);
 assert.match(cube,/No verified public marketplace listings/);
});
test("marketplace handles the silo schema and empty states",()=>{
 assert.match(cube,/data\.silos/);
 assert.match(cube,/data\.items/);
 assert.match(cube,/Market directories unavailable/);
 assert.match(cube,/Marketplace catalog unavailable/);
});
test("auctions show no invented live examples on missing API",()=>{
 assert.match(auctions,/No server-verified auctions are available/);
 assert.doesNotMatch(auctions,/AUC-MTG-FETCHLAND-001/);
 assert.doesNotMatch(auctions,/dreamledger_bid_proofs/);
 assert.match(auctions,/No verified bid was placed/);
});
test("frontend JavaScript is syntactically valid",()=>{
 for(const page of [cube,auctions]){
  const units=scripts(page);
  assert.ok(units.length>0);
  for(const unit of units)assert.doesNotThrow(()=>new vm.Script(unit));
 }
});
