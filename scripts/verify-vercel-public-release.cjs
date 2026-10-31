'use strict';
// Fail closed on unapproved customer pages, accidental checkout activation, or
// an overwritten construction homepage. This is not sales verification.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),pub=path.join(root,'public-release');
const vercel=JSON.parse(fs.readFileSync(path.join(root,'vercel.json'),'utf8'));
assert.equal(vercel.outputDirectory,'public-release','release output must be filtered');
assert.equal(vercel.git.deploymentEnabled,false,'public deployment requires owner approval');
const required=[
 'index.html','billboard.html','avatar.html','ticker.html','mtg/index.html','mtg/community.html',
 'mtg/exchange.html','mtg/diagnostic/index.html','mtg/auctions/index.html',
 'catalog.json','data/mtg-catalog.json','data/mtg-owner-decks.json','data/mtg-owner-singles.json',
 'assets/dreamledger-mtg-theme.css','assets/mtg-auction-rail.js','assets/avatar-identity.js'
];
for(const rel of required)assert.ok(fs.statSync(path.join(pub,rel),{throwIfNoEntry:false})?.isFile(),'MISSING:'+rel);
const home=fs.readFileSync(path.join(pub,'index.html'),'utf8');
assert.match(home,/data-public-gate="owner-construction-v1"/);
for(const p of ['/mtg/','/avatar.html','/billboard.html'])assert.ok(home.includes('href="'+p+'"'),'FRONT_DOOR_MISSING:'+p);
assert.doesNotMatch(home,/agentic|agent.bridge|truth.oracle|quote.compare|\bElohim\b|\bGauntlet\b/i);
const magic=fs.readFileSync(path.join(pub,'mtg/index.html'),'utf8');
assert.match(magic,/Wizards of the Coast Fan Content Policy/);
assert.match(magic,/id="deckRail"/);
const billboard=fs.readFileSync(path.join(pub,'billboard.html'),'utf8');
assert.match(billboard,/data-demo-proof="visible-without-js"/);
assert.match(billboard,/New purchases temporarily held/);
const catalog=JSON.parse(fs.readFileSync(path.join(pub,'catalog.json'),'utf8'));
const mtg=JSON.parse(fs.readFileSync(path.join(pub,'data/mtg-catalog.json'),'utf8'));
assert.equal(catalog.schema,'dreamledger/public-catalogue/v1');
assert.ok(catalog.products.length>0);
const ids=new Set(mtg.products.map(x=>x.id));
for(const p of catalog.products){assert.ok(ids.has(p.id),'CROSS_SILO_CATALOG_LEAK:'+p.id);assert.equal(p.checkout_available,false,p.id+': checkout held');}
const banned=['agent-bridge.html','agentic-commerce-remediation-blueprint.html','truth-oracle.html',
 'quote-compare-49.html','pulse/index.html','b2b.html','marketplace.html','shop.html'];
for(const rel of banned)assert.equal(fs.existsSync(path.join(pub,rel)),false,'UNAPPROVED_PUBLIC_FILE:'+rel);
console.log(JSON.stringify({result:'PASS',schema:'dreamledger/public-approved-release/v1',approved_surfaces:['mtg','avatar','billboard','ticker'],files_checked:required.length,blocked_examples:banned.length,checkout_verified:false,production_deployed:false}));
