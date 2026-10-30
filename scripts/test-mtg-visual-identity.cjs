'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const css=read('public/assets/dreamledger-mtg-theme.css');
assert.match(css,/--silo-accent:#45fa84/);
assert.match(css,/#060a08/);
assert.match(css,/--silo-serif:system-ui/);
assert.match(css,/@media\(max-width:700px\)/);
assert.doesNotMatch(css,/@import|fonts\.googleapis/);
const m=JSON.parse(read('public/silos/mtg/silo.json'));
assert.equal(m.accent,'#45fa84');
const pages=['public/mtg/index.html','public/mtg/exchange.html','public/mtg/community.html',
'public/mtg/diagnostic/index.html','public/mtg/quintorius-field-historian.html',
'public/mtg/dwynen-gilt-leaf-daen.html','public/mtg/jon-irenicus-shattered-one.html',
'mtg/index.html','BEC-PRIME/compiled/website/mtg/index.html',
'BEC-PRIME/website/mtg-catalog.html'];
for(const p of pages){
 const s=read(p);
 assert.match(s,/data-silo="mtg"/,p+': must be MTG silo');
 assert.match(s,/dreamledger-mtg-theme\.css/,p+': shared theme required');
 assert.doesNotMatch(s,/<script[^>]+src="https:\/\//i,p+': unexpected external scripts');
}
for(const p of ['public/mtg/index.html','public/mtg/exchange.html','public/mtg/community.html']){
 const s=read(p);
 assert.match(s,/class="mtg-header"/,p+': consistent navigation');
 assert.match(s,/class="mtg-footer"/,p+': consistent footer');
 const head=s.slice(s.indexOf('<header'),s.indexOf('</header>')+9);
 assert.doesNotMatch(head,/Happy Homarid|patreon\.com|discord\.gg/i,p+': creator brand belongs in footer');
 assert.match(s.slice(s.indexOf('<footer')),/Happy Homarid Patreon/,p+': Patreon footer link preserved');
 for(const block of [...s.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]){
  if(block[1].trim())new vm.Script(block[1],{filename:p});
 }
}
const home=read('public/mtg/index.html');
assert.match(home,/class="mtg-hero"/);
assert.match(home,/0%.*platform commission/);
assert.match(home,/id="deckRail"/);
assert.match(home,/id="singleRail"/);
assert.match(home,/\/data\/mtg-owner-decks\.json/);
assert.match(home,/\/data\/mtg-owner-singles\.json/);
assert.match(home,/\/data\/mtg-catalog\.json/);
assert.match(home,/\/catalog\.json/);
assert.match(home,/NZ\$29/);
assert.doesNotMatch(home,/\bNZ\$230\b|free Commander diagnostic|internal control plane/i);
const trade=read('public/mtg/community.html');
assert.match(trade,/id="compose"/);
assert.match(trade,/navigator\.clipboard\.writeText/);
assert.doesNotMatch(trade,/fetch\(['"]\/api\/.*(create|post|listing)|buy\.stripe\.com/i);
assert.match(trade,/ledger is not live yet|ledger is not live|ledger is being tested|ledger is being built|bilateral ledger is not live yet/i);
const gallery=read('public/mtg/exchange.html');
assert.match(gallery,/id="find"/);assert.match(gallery,/id="sort"/);
assert.match(gallery,/id="deckGrid"/);
assert.match(gallery,/\/data\/mtg-catalog\.json/);
assert.match(gallery,/community\.html/);
const diag=read('public/mtg/diagnostic/index.html');
assert.match(diag,/NZ\$29/);
assert.match(diag,/Pay NZ\$29: checkout held/);
assert.match(diag,/Verify Patreon: integration held/);
assert.match(diag,/\$2\.99 paid Patreon tier/);
assert.match(diag,/up to five/i);
assert.doesNotMatch(diag,/Run free diagnostic|Free Commander diagnostic/i);
console.log('MTG REDESIGN PASS: coherent pages, gated commerce, no-login-free diagnostic absent, responsive system.');
