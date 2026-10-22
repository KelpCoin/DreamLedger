import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const app=require('../../../public/assets/mtg-deck-check.js');
test('real browser-only Commander structural check handles ManaBox formatting',()=>{
 const deck=['1 Sol Ring (CMM) 396','1 Arcane Signet','1 Command Tower',
  '1 Forest','1 Swamp','1 Counterspell','1 Rhystic Study','1 Cultivate',
  '1 Path to Exile','1 Forest'].join('\n');
 const a=app.analyze(deck);
 assert.equal(a.declared_card_count,10);
 assert.equal(a.recognised_by_name.land,4);
 assert.equal(a.recognised_by_name.ramp,3);
 assert.equal(a.recognised_by_name.interaction,2);
 assert.equal(a.recognised_by_name.draw,1);
 assert.equal(a.network_calls,0);
 assert.equal(a.raw_decklist_retained,false);
 assert.equal(a.status,'LOCAL_HEURISTIC_ONLY');
});
test('no fake simulations or empty list promotions',()=>{
 assert.throws(()=>app.analyze('1 Sol Ring'),/at least ten/);
 assert.throws(()=>app.analyze(('1 Sol Ring\n').repeat(201)),/too many lines/);
 assert.throws(()=>app.analyze(('99 Sol Ring\n').repeat(10)),/quantities/);
});
test('public MTG page exposes local free tool while paid offer stays held',()=>{
 const home=fs.readFileSync('public/mtg/index.html','utf8');
 const free=fs.readFileSync('public/mtg/deck-check.html','utf8');
 const paid=fs.readFileSync('public/commander-deck-diagnostic.html','utf8');
 assert.match(home,/href="\/mtg\/deck-check.html"/);
 assert.match(free,/Your decklist stays on this device/);
 assert.match(free,/not sent to our servers/);
 assert.match(free,/payment, intake, analysis and delivery are proven/);
 assert.match(paid,/currently held|Currently held/);
 for(const s of [...free.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]){
   new vm.Script(s[1]);
 }
});
test('public singles search cannot create unverifiable example listings',()=>{
 for(const page of ['public/mtg-search.html','public/mtg-search/index.html']){
   const s=fs.readFileSync(page,'utf8');
   assert.doesNotMatch(s,/var SEED\s*=\s*\[\{/);
   assert.doesNotMatch(s,/SEED\s*=\s*\[/);
   assert.match(s,/0 independently verified public listings/);
   assert.match(s,/PRIVATE DRAFT · NOT PUBLISHED/);
   assert.match(s,/no public listings are verified yet/i);
   assert.doesNotMatch(s,/Have 3|Rhystic Study.*35/);
 }
});
test('seller routes do not imply that a private draft is published',()=>{
 const listing=fs.readFileSync('public/mtg-list.html','utf8');
 const alias=fs.readFileSync('public/mtg-list/index.html','utf8');
 assert.match(listing,/only on this device|local-only/i);
 assert.match(listing,/It has not been published/);
 assert.doesNotMatch(listing,/Join to publish|free account to publish/);
 assert.match(alias,/Private|private/);
 assert.doesNotMatch(alias,/href="\/buy\/COMMANDER-DECK-DIAGNOSTIC-001"/);
});

test('legacy paid intake/success and marketplace endpoints cannot claim real orders during migration',()=>{
  for(const name of ['public/diagnostic-input.html','public/thanks-diagnostic.html',
    'public/mtg-marketplace.html','public/mtg-marketplace/index.html']){
    const s=fs.readFileSync(name,'utf8');
    assert.match(s,/not available|not yet verified|not yet|historical|being restored/i);
    assert.doesNotMatch(s,/https:\/\/buy\.stripe\.com\//i);
    assert.doesNotMatch(s,/\/api\/commercial\/input|\/api\/mtg\/marketplace\/listings/);
    assert.doesNotMatch(s,/<form[\s>]/i);
  }
});
