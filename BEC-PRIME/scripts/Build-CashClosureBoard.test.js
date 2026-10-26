'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {assemble,statusOf,render,auditConsumerCatalog}=require('./Build-CashClosureBoard');
const { consumerReleaseVerdict }=require('../gauntlet/GauntletV6');
const registry={silos:[{id:'mtg',label:'MTG',route:'/mtg'}, {id:'digital-products',label:'Digital',route:'/digital-products.html'}]};
const a={offer_id:'O-1',product_id:'P-1',silo:'mtg',name:'Commander',price:29,approved_by:'operator',payment_link_status:'ACTIVE_LIVEMODE',payment_link_url:'https://buy.stripe.com/example'};
const live={offers:[{offer_id:'O-1',checkout:a.payment_link_url}]};
const held={status:'held',commercial_truth:{sellable:false},checkout:{mode:'disabled'}};
const ready={status:'active',commercial_truth:{sellable:true,payment_link:a.payment_link_url},checkout:{mode:'payment_link'}};
const make=(p,rest={})=>assemble({registry,approved:{approved:[a]},live,products:{'P-1':p},watch:[{id:'dooh',label:'DOOH'}],...rest});
test('held product always wins over claimed live checkout',()=>{const r=make(held);assert.equal(r.silos.find(x=>x.silo_id==='mtg').state,'HOLD_PRODUCT');assert.equal(r.counts.source_declared_checkout_count,1);});
test('missing product never appears sellable',()=>assert.equal(make(null).silos.find(x=>x.silo_id==='mtg').state,'MISSING_PRODUCT'));
test('contradictory checkout link blocks external publication',()=>{const r=make(ready,{live:{offers:[{offer_id:'O-1',checkout:'https://buy.stripe.com/different'}]}});assert.equal(r.next_human_action.state,'LINK_CONFLICT')});
test('matching static data is not payment or fulfilment proof',()=>{const r=make(ready);assert.equal(r.silos.find(x=>x.silo_id==='mtg').state,'VERIFY_DELIVERY');assert.equal(r.truth.new_external_revenue_attributed_nzd,null);});
test('registered silos and watch lanes are retained without invented buyers',()=>{const r=make(held);assert.equal(r.counts.silos_monitored,3);assert.equal(r.silos.find(x=>x.silo_id==='dooh').registered,false);assert.equal(r.silos.find(x=>x.silo_id==='digital-products').state,'NO_APPROVED_OFFER');});
test('adult hard silo is excluded from shared report',()=>{const r=make(held,{watch:[{id:'amplissa'}, {id:'dooh'}]});assert.equal(r.silos.some(x=>x.silo_id==='amplissa'),false)});
test('untrusted HTML labels are escaped',()=>{const r=make(held,{watch:[{id:'dooh',label:'<script>alert(1)</script>'}]});const page=render(r);assert.equal(page.includes('<script>'),false);assert.ok(page.includes('&lt;script&gt;'));});
test('invalid watch silo identifiers fail closed',()=>assert.throws(()=>make(held,{watch:[{id:'../../evil'}]}),/INVALID_SILO_ID/));
test('invalid registry fails closed',()=>assert.throws(()=>assemble({registry:{},approved:{approved:[]},live:{offers:[]}}),/INVALID_SILO_REGISTRY/));
test('no outbound side effects are authorized by output',()=>{const r=make(ready);assert.equal(r.restrictions.external_actions,false);assert.equal(r.restrictions.automatic_publication,false);assert.equal(r.restrictions.silo_deletion,false);});
test('unmatched live record cannot manufacture sellable inventory',()=>{const r=make(held,{live:{offers:[...live.offers,{offer_id:'EXTERNAL-UNKNOWN',silo:'commerce',checkout:'https://buy.stripe.com/other'}]}});assert.equal(r.silos.find(x=>x.silo_id==='commerce').offer_count,0);assert.equal(r.truth.fulfilled_orders_verified,null);});

const consumerAudit=(catalog,extra={})=>auditConsumerCatalog({
  catalog:{products:catalog},
  registry:{silos:[{id:'pet',route:'/pet.html'},{id:'digital-products',route:'/digital-products.html'}]},
  approved:{approved:[]},
  qrExists:true,doorwayExists:true,...extra
});
test('consumer checkout source claims never imply verified deliverability',()=>{
  const report=consumerAudit([{id:'PET-1',status:'published',checkout_available:true,
    checkout_url:'https://buy.stripe.com/abcd123',delivery_test_status:'VERIFIED'}]);
  assert.equal(report.declared_checkout_count,1);
  assert.equal(report.products[0].independently_sellable,false);
  assert.equal(report.products[0].verdict,'UNVERIFIED_END_TO_END_DELIVERY');
  assert.equal(report.independently_verified_sellable_truth,'UNKNOWN_NOT_TESTED');
  assert.equal(report.no_purchase_actions_performed,true);
});
test('one canonical QR for the entire consumer marketplace, not per item',()=>{
  const products=Array.from({length:1000},(_,i)=>({id:'D-'+i,status:'held',checkout_available:false}));
  const report=consumerAudit(products);
  assert.equal(report.checked_product_count,1000);
  assert.equal(report.canonical_qr.policy,'ONE_PRINT_ACQUISITION_CODE_NOT_PER_PRODUCT');
  assert.equal(report.canonical_qr.source_asset_present,true);
  assert.equal(report.silo_capacity_limit,null);
  assert.equal(JSON.stringify(report).includes('qr_per_product'),false);
});
test('declared seed routes without files identified as static-source gaps, not HTTP failures',()=>{
  const report=consumerAudit([{id:'A',status:'held'}],{routeExists:route=>route==='/pet.html'});
  assert.equal(report.source_route_gaps,1);
  assert.equal(report.routes[1].live_http_status,'UNKNOWN');
  assert.equal(report.routes[0].matching_static_file,true);
});
test('marked-purchasable item with no checkout link is quarantined as contradictory',()=>{
  const report=consumerAudit([{id:'A',status:'published',checkout_available:true,checkout_url:null}]);
  assert.equal(report.products[0].verdict,'CLAIMED_CHECKOUT_WITHOUT_VALID_LINK');
  assert.equal(report.products[0].independently_sellable,false);
});
test('duplicated product IDs and malformed data fail closed',()=>{
  assert.throws(()=>consumerAudit([{id:'A'},{id:'A'}]),/DUPLICATE_OR_MISSING_PRODUCT_ID/);
  assert.throws(()=>auditConsumerCatalog({catalog:{products:[]},registry:{},approved:{approved:[]}}),/INVALID_CONSUMER_INPUT/);
});

test('existing Gauntlet blocks even a valid-looking Stripe checkout with unproven delivery',()=>{
  const report=consumerAudit([{id:'PET-1',status:'published',checkout_available:true,
    checkout_url:'https://buy.stripe.com/valid123',delivery_test_status:'VERIFIED'}]);
  const verdict=consumerReleaseVerdict(report);
  assert.equal(verdict.status,'FAIL');
  assert.equal(verdict.blocked_count,1);
  assert.equal(verdict.blocked[0].product_id,'PET-1');
  assert.equal(verdict.reason,'UNVERIFIED_CONSUMER_CHECKOUT_MUST_NOT_BE_PUBLISHED');
});
test('existing Gauntlet allows an honest empty or held catalog without inventing buyers',()=>{
  const report=consumerAudit([{id:'A',status:'held',checkout_available:false,checkout_url:null}]);
  const verdict=consumerReleaseVerdict(report);
  assert.equal(verdict.status,'PASS');
  assert.equal(verdict.declared_checkout_count,0);
  assert.equal(verdict.blocked_count,0);
});
test('existing Gauntlet fails closed when consumer audit proof is missing',()=>{
  assert.equal(consumerReleaseVerdict(null).status,'FAIL');
});
