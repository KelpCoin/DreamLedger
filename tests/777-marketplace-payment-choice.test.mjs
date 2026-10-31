import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {evaluateMarketplaceQuote,checkQuoteIntegrity} from '../webapp/agentic-commerce/marketplace-payment-choice-gate.mjs';
const policy=JSON.parse(readFileSync(new URL('../docs/BECK-EMPIRE-SILO-REGISTRY.json',import.meta.url),'utf8'));
const at='2026-11-01T00:00:00.000Z';
const item={
 listing_id:'sample-asset:01',owner_id:'seller:synthetic',
 status:'verified_available',provenance:{source_sha256:'a'.repeat(64)},
 price:{amount:400,currency:'NZD',billing_mode:'fixed'}
};
const provider={code:'synthetic_provider',available:true,seller_enabled:true,
 supported_currency:'NZD',provider_terms_url:'https://example.invalid/terms',
 provider_terms_sha256:'b'.repeat(64),observed_at:'2026-10-31T00:00:00.000Z',
 total_fee_cents:175};
const args={listing:item,silo_id:'dreamledger-mtg',item_cents:40000,
 shipping_cents:1240,payment_quotes:[provider],policy,actor:{kind:'human',id:'buyer:synthetic'},now:at};
const quote=(d={})=>evaluateMarketplaceQuote({...args,...d});
test('MTG 0% platform fee, no payment initiated, and deterministic receipt',()=>{
 let a=quote();assert.equal(a.fee_policy_bps,0);
 assert.equal(a.gross_minor,41240);
 assert.equal(a.payment_options[0].rail_fee_cents,175);
 assert.equal(a.payment_options[0].platform_fee_cents,0);
 assert.equal(a.action_status,'QUOTE_ONLY_NOT_PAYABLE');
 assert.equal(a.payment_status,'NOT_INITIATED');
 assert.equal(a.settlement_verified,false);
 assert.equal(a.delivery_verified,false);
 assert.ok(checkQuoteIntegrity(a));
 assert.deepEqual(a,quote());
});
test('unrelated non-MTG B2B sector uses 5% fee from canonical policy',()=>{
 let a=quote({silo_id:'industrial-surplus'});
 assert.equal(a.fee_policy_bps,500);
 assert.equal(a.payment_options[0].platform_fee_cents,2062);
 assert.equal(a.action_status,'QUOTE_ONLY_NOT_PAYABLE');
});
test('agent quote does not imply agent transaction authority or mandate',()=>{
 let a=quote({actor:{kind:'agent',id:'agent:test-001'}});
 assert.match(a.authority_status,/MANDATE/);
 assert.equal(a.payment_status,'NOT_INITIATED');
});
test('no client-controlled fee basis points can override canonical policy',()=>{
 assert.equal(quote({fee_basis_points:0}).fee_policy_bps,0);
 const tampered=JSON.parse(JSON.stringify(policy));tampered.silos.OTHER.platform_fee_bps=0;
 assert.throws(()=>quote({silo_id:'wholesale',policy:tampered}),/FEE_POLICY_DRIFT/);
});
test('no price from seller ask mismatch',()=>{
 assert.throws(()=>quote({item_cents:39999}),/CANONICAL_PRICE_MISMATCH/);
});
test('provider must be explicitly available, enabled and in exact currency',()=>{
 for(const overrides of [{available:false},{seller_enabled:false},{supported_currency:'USD'},{provider_terms_sha256:''}]){
  assert.throws(()=>quote({payment_quotes:[{...provider,...overrides}]}),/RAIL_VERIFICATION_REQUIRED/);
 }
});
test('old or future provider terms evidence is refused',()=>{
 assert.throws(()=>quote({payment_quotes:[{...provider,observed_at:'2020-01-01T00:00:00.000Z'}]}),/STALE_RAIL_QUOTE/);
 assert.throws(()=>quote({payment_quotes:[{...provider,observed_at:'2027-01-01T00:00:00.000Z'}]}),/STALE_RAIL_QUOTE/);
});
test('duplicate provider codes rejected',()=>{
 assert.throws(()=>quote({payment_quotes:[provider,provider]}),/DUPLICATE_RAIL/);
});
test('unverified listing or versionless empty invoice refused',()=>{
 assert.throws(()=>quote({listing:{...item,status:'candidate'}}),/UNVERIFIED_LISTING/);
 assert.throws(()=>quote({listing:{...item,provenance:{source_sha256:'unknown'}}}),/UNVERIFIED_LISTING/);
});
test('zero/negative/fractional currency amounts never round silently',()=>{
 for(const n of [-1,0.5,NaN,Infinity])assert.throws(()=>quote({shipping_cents:n}),/INVALID_SHIPPING/);
 assert.throws(()=>quote({quantity:0}),/INVALID_QUANTITY/);
});
test('signed provider quote not claimable as actual settlement',()=>{
 let a=quote();a.payment_status='SETTLED';assert.equal(checkQuoteIntegrity(a),false);
 a=quote();a.settlement_verified=true;assert.equal(checkQuoteIntegrity(a),false);
});
test('multiple alternative rails compare quotes without forcing a rail',()=>{
 let b={...provider,code:'synthetic_provider_b',total_fee_cents:300};
 let a=quote({payment_quotes:[b,provider]});
 assert.deepEqual(a.payment_options.map(x=>x.code),['synthetic_provider','synthetic_provider_b']);
 assert.equal(a.action_status,'QUOTE_ONLY_NOT_PAYABLE');
});
test('provider evidence is a quoted fee only, no real processor account or payout',()=>{
 let a=quote();assert.equal(a.payment_options[0].provider_onboarding,'NOT_VERIFIED_BY_THIS_MODULE');
 assert.match(a.legal_review,/REQUIRED/);
});
