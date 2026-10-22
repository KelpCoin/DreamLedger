import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require=createRequire(import.meta.url);
const search=readFileSync('public/mtg-search.html','utf8');
const draft=readFileSync('public/mtg-list.html','utf8');
const index=readFileSync('public/mtg-list/index.html','utf8');
const deck=readFileSync('public/mtg/deck-check.html','utf8');
const engine=readFileSync('public/assets/mtg-deck-check.js','utf8');
function inline(html) {
  return [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(x=>x[1]);
}

test('MTG private draft, search and free deck-check browser scripts parse',()=>{
  for(const [name,html] of [['search',search],['draft',draft],['deck',deck]]) {
    const scripts=inline(html);
    assert.ok(scripts.length>0,name);
    for(const script of scripts) assert.doesNotThrow(()=>new vm.Script(script),name);
  }
  assert.doesNotThrow(()=>new vm.Script(engine));
});
test('local seller route is a draft only, never false publication',()=>{
  assert.match(index,/url=\/mtg-list\.html/);
  assert.match(index,/Publishing is not available yet/);
  assert.match(draft,/has not been published or sent to any seller service/);
  assert.doesNotMatch(draft,/Join to publish|action="\/api\/mtg\/marketplace/);
});
test('singles search renders locally stored private drafts with no purchasable inventory',()=>{
  const elements={};
  for(const id of ['q','city','cond','count','list']) {
    elements[id]={value:'',textContent:'',innerHTML:'',addEventListener(){}};
  }
  const local=JSON.stringify({title:'Sol Ring',condition:'Near Mint',
    finish:'Non-foil',city:'Auckland',price_nzd:4,notes:'Sample private draft'});
  const scripts=inline(search);
  assert.equal(scripts.length,1);
  const ctx={
    document:{getElementById(id){assert.ok(elements[id],id);return elements[id];}},
    localStorage:{getItem(key){return key==='dreamledger_mtg_single_draft'?local:null;}}
  };
  assert.doesNotThrow(()=>vm.runInNewContext(scripts[0],ctx));
  assert.match(elements.count.textContent,/0 independently verified public listings/);
  assert.match(elements.count.textContent,/1 private draft/);
  assert.match(elements.list.innerHTML,/PRIVATE DRAFT · NOT PUBLISHED/);
  assert.match(elements.list.innerHTML,/Draft asking price: NZ\$4\.00/);
  assert.doesNotMatch(elements.list.innerHTML,/Buy now|Add to cart|buy\.stripe\.com/);
});
test('free deck engine runs locally and labels its conclusions as heuristic',()=>{
  const api=require('../../../public/assets/mtg-deck-check.js');
  assert.equal(typeof api.analyze,'function');
  assert.throws(()=>api.analyze('1 Sol Ring\n1 Command Tower'),/at least ten/);
  const sample=Array.from({length:12},(_,i)=>{
    if(i===0) return '1 Sol Ring';
    if(i===1) return '1 Command Tower';
    return '1 Sample Spell '+i;
  }).join('\n');
  const report=api.analyze(sample);
  assert.equal(report.status,'LOCAL_HEURISTIC_ONLY');
  assert.equal(report.network_calls,0);
  assert.equal(report.payment_required,false);
  assert.equal(report.raw_decklist_retained,false);
  assert.equal(report.declared_card_count,12);
});
test('G08 probes MTG tools and rejects unported seller/account API',()=>{
  const checks=readFileSync('ops/migration/cloudflare-preview/smoke-preview.mjs','utf8');
  for(const route of ['/mtg/deck-check.html','/mtg-search.html','/mtg-list.html',
      '/mtg-list/','/api/mtg/marketplace/listings','/api/account/register']){
    assert.ok(checks.includes("path: '"+route+"'"),'Missing G08 route: '+route);
  }
});
