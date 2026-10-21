'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {buildCatalog}=require('./AgentMarketplaceCatalog');
const master={silo:'mtg',updated:'2026-10-22',products:[
  {id:'DECK1',silo:'mtg',category:'commander-deck',status:'published',inventory:1,price:90,name:'Commander Deck',description:'Deck notes',detail_url:'/mtg/deck1.html',claim_url:'mailto:example@domain.com',patreon_price:80},
  {id:'HELD',silo:'mtg',category:'digital-service',status:'held',inventory:0,price:29,name:'Held digital report',checkout_url:'https://buy.stripe.com/example'},
  {id:'ADULT',silo:'amplissa',category:'commander-deck',status:'published',inventory:1,price:100,name:'Cross-silo',seller_address:'secret'},
  {id:'EMPTY',silo:'mtg',category:'commander-deck',status:'published',inventory:0,price:100,name:'Out of stock'}
]};
const peer=[{id:'peer1',status:'active',seller_id:'internal_account_id',seller_display_name:'NZ MTG Seller',seller_compliance:{legal_name:'Secret Name',contact_address:'Secret Address',captured_ip:'1.2.3.4'},title:'Single',description:'One card',price_nzd:8.5,accepts_buy:true,accepts_trade:true,category:'single',image_url:'javascript:alert(1)',trader_status:'private'},
{id:'peer2',status:'draft',title:'Private unfinished listing',accepts_buy:true,price_nzd:5},
{id:'peer3',status:'active',silo_id:'amplissa',title:'Cross silo',accepts_buy:true,price_nzd:12}];

test('catalogue combines only publishable MTG records, not adult, held, or empty',()=>{
  const out=buildCatalog(master,peer);
  assert.equal(out.silo_id,'mtg');
  assert.equal(out.total,2);
  assert.deepEqual(out.listings.map(x=>x.id),['mtg:master:DECK1','mtg:peer:peer1']);
  assert.equal(out.fees.platform_success_nzd,0);
  assert.equal(out.payment_enabled,false);
});
test('seller PII and legacy checkout links never appear in agent surface',()=>{
  const wire=JSON.stringify(buildCatalog(master,peer));
  for(const secret of ['Secret Name','Secret Address','1.2.3.4','internal_account_id','mailto:','buy.stripe.com','patreon_price','javascript:','amplissa']){
    assert.equal(wire.includes(secret),false,secret+' leaked');
  }
});
test('agent can discover but can never infer autonomous purchase or verified inventory',()=>{
  const cat=buildCatalog(master,peer);
  assert.equal(cat.agent_permissions.purchase,false);
  assert.equal(cat.agent_permissions.autonomous_spend,false);
  assert.equal(cat.protocol_status.ucp,'NOT_IMPLEMENTED');
  assert.equal(cat.protocol_status.ap2,'NOT_IMPLEMENTED');
  for(const x of cat.listings){
    assert.equal(x.checkout.available,false);
    assert.equal(x.availability,'SELLER_CONFIRMATION_REQUIRED');
    assert.equal(x.economic_state,'DISCOVERY_ONLY');
    assert.equal(x.purchase_authority,'EXPLICIT_HUMAN_AUTHORIZATION_REQUIRED');
  }
});
test('missing source is UNOBSERVABLE, not a claim of zero inventory',()=>{
  const r=buildCatalog({},[],{master:'UNOBSERVABLE',peer:'UNOBSERVABLE'});
  assert.equal(r.source_state.master,'UNOBSERVABLE');
  assert.equal(r.source_state.peer,'UNOBSERVABLE');
  assert.equal(r.total,0);
});
test('public URLs fail closed and only allow local MTG routes',()=>{
  const out=buildCatalog(master,peer);
  assert.equal(out.listings[0].detail_url,'/mtg/deck1.html');
  assert.equal(out.listings[1].image_url,null);
  assert.equal(out.listings[1].detail_url,'/mtg/');
});
