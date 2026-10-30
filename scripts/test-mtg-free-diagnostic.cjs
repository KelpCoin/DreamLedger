'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
const parser=require('../public/mtg/diagnostic/parse.js');
const engine=require('../public/mtg/diagnostic/engine.js');
const html=fs.readFileSync(path.join(root,'public/mtg/diagnostic/index.html'),'utf8');
function fixture(land=36,mv=2,spirit=20){
 const entries=Array.from({length:100},(_,i)=>({name:'Card '+i, type_line:i<land?'Basic Land':'Creature',cmc:i<land?0:mv,oracle_text:i>=land&&i<land+spirit?'Spirit graveyard':'Vanilla'}));
 const text=entries.map(x=>'1 '+x.name).join('\n');
 const p=parser.parse(text,'Card 0');
 return {p,cards:entries};
}
test('free no-login browser page with zero hidden fees',()=>{
 assert.match(html,/Run free diagnostic/);
 assert.match(html,/No login, email, payment or subscription/);
 assert.doesNotMatch(html,/NZ\$29|pay NZ|Pay diagnostic|Patreon members are exempt/i);
 assert.match(html,/https:\/\/api.scryfall.com\/cards\/collection/);
 const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(x=>x[1]).filter(Boolean);
 assert.ok(scripts.length>=1);
 for(const src of scripts) new vm.Script(src);
});
test('100 card paste parses, including Scryfall set/collector notation',()=>{
 const {p}=fixture();assert.equal(p.valid,true);assert.equal(p.total,100);
 assert.equal(p.deck.boards.commander.length,1);assert.equal(p.deck.boards.main.length,99);
 const x=parser.parse('Commander:\n1 Card 0 (CMM) 012\nDeck:\n99 Plains (M21) 260','Card 0');
 assert.equal(x.valid,true);assert.equal(x.cards.length,2);
});
test('incomplete deck is quarantined, never represented as a complete result',()=>{
 const p=parser.parse('1 Card 0\n98 Plains','Card 0');assert.equal(p.valid,false);
 assert.match(p.warnings.join(' '),/99/);
});
test('invalid quantity, names and malicious markup cannot create a valid list',()=>{
 assert.throws(()=>parser.parse('1 Card 0',''),/commander/i);
 const p=parser.parse('1 Card 0\n99 <script>alert(1)</script>','Card 0');
 assert.equal(p.valid,false);assert.equal(p.invalid_lines.length,1);
 assert.throws(()=>parser.parse('x'.repeat(30001),'Card 0'),/30,000/);
});
test('land/curve pass when all metadata resolves; semantics remain limited',()=>{
 const {p,cards}=fixture(36,2,20),v=engine.evaluate(p.deck,cards);
 assert.equal(v.verdict,'PASS');assert.equal(v.unresolved,0);assert.equal(v.land_count,36);
});
test('bad land count or high curve fails',()=>{
 const {p,cards}=fixture(22,5,0),v=engine.evaluate(p.deck,cards);
 assert.equal(v.verdict,'FAIL');
});
test('missing metadata or unrelated archetype is quarantined, not guessed',()=>{
 const {p,cards}=fixture(36,2,0);
 assert.equal(engine.evaluate(p.deck,[]).verdict,'QUARANTINE');
 assert.equal(engine.evaluate(p.deck,cards).verdict,'QUARANTINE');
});
test('root and source masters link the free tool',()=>{
 for(const file of ['public/mtg/index.html','mtg/index.html','BEC-PRIME/compiled/website/mtg/index.html','BEC-PRIME/website/mtg-catalog.html','public/mtg/exchange.html']){
  const s=fs.readFileSync(path.join(root,file),'utf8');
  assert.match(s,/\/mtg\/diagnostic\//,file);
  assert.doesNotMatch(s,/Commander diagnostic NZ\$29|NZ\$29 Commander diagnostic|Paid diagnostic/i,file);
 }
});
console.log('MTG FREE DIAGNOSTIC: test suite complete (production release remains HOLD).');
