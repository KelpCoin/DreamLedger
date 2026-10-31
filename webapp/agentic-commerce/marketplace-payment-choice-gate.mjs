// Shared B2B/A2A marketplace PRICE DISCOVERY gate for 777.
// Reuses the existing marketplace listing and Agent Bridge contracts.
// Never selects a real payment instrument, initiates settlement or writes to a ledger.
import {createHash} from 'node:crypto';
const CURRENCIES=/^[A-Z]{3}$/;
const HASH=/^[a-f0-9]{64}$/;
const ID=/^[a-zA-Z0-9_.:-]{3,128}$/;
const MAX=100000000000; // Amounts are integer minor units.
const fail=code=>{throw Error('MARKETPLACE_QUOTE_'+code)};
const cents=(v,key)=>Number.isSafeInteger(v)&&v>=0&&v<=MAX?v:fail('INVALID_'+key);
const required=(s,key)=>typeof s==='string'&&ID.test(s)?s:fail('INVALID_'+key);
const digest=val=>createHash('sha256').update(JSON.stringify(val)).digest('hex');
function observed(iso,key,nowMs){
 const t=Date.parse(iso);
 if(typeof iso!=='string'||!Number.isFinite(t)||t>nowMs||nowMs-t>30*24*3600*1000)fail('STALE_'+key);
 return iso;
}
export function evaluateMarketplaceQuote({
 listing, quantity=1, item_cents, shipping_cents, payment_quotes, policy, actor,
 now='2026-11-01T00:00:00.000Z'
}={}){
 const ms=Date.parse(now);
 if(!Number.isFinite(ms))fail('INVALID_TIME');
 if(!listing||typeof listing!=='object'||listing.status!=='verified_available'||
  !required(listing.listing_id,'LISTING_ID')||!HASH.test(listing.provenance?.source_sha256||'')||
  !CURRENCIES.test(listing.price?.currency||'')||
  listing.price?.billing_mode!=='fixed')fail('UNVERIFIED_LISTING');
 if(!Number.isSafeInteger(quantity)||quantity<1||quantity>10000)fail('INVALID_QUANTITY');
 const unit=cents(item_cents,'UNIT_PRICE');
 if(unit<=0||unit!==Math.round(listing.price.amount*100))fail('CANONICAL_PRICE_MISMATCH');
 const shipping=cents(shipping_cents,'SHIPPING');
 const total=unit*quantity+shipping;
 cents(total,'TOTAL');
 if(!policy||policy.schema!=='BECK/EMPIRE-SILO-REGISTRY/v1'||
  !policy.silos||!policy.silos.MTG||!policy.silos.OTHER)fail('UNTRUSTED_FEE_POLICY');
 const silo=required(listing.silo_id,'SILO_ID');
 // Fee policy is a server-owned read of the existing Canonical Registry.
 // No buyer-provided basis points may override it.
 const isMaster=silo==='dreamledger-mtg'||silo==='mtg-master';
 const platformBps=isMaster?policy.silos.MTG.platform_fee_bps:policy.silos.OTHER.platform_fee_bps;
 if(platformBps!==(isMaster?0:500))fail('FEE_POLICY_DRIFT');
 const fee=Math.floor((total*platformBps+5000)/10000);
 const caller=actor?.kind||'human';
 if(!['human','agent'].includes(caller))fail('INVALID_ACTOR');
 const actorId=required(actor?.id,'ACTOR_ID');
 const authority=caller==='human'?'USER_CHECKOUT_APPROVAL_REQUIRED':
   'MANDATE_SIGNATURE_QUOTA_AND_REVOCATION_UNVERIFIED';
 if(!Array.isArray(payment_quotes)||payment_quotes.length<1||payment_quotes.length>12)fail('PAYMENT_QUOTES_REQUIRED');
 const offers=[];const codes=new Set();
 for(const q of payment_quotes){
  if(!q||typeof q!=='object')fail('INVALID_RAIL_QUOTE');
  const code=required(q.code,'RAIL_CODE');
  if(codes.has(code))fail('DUPLICATE_RAIL');
  codes.add(code);
  if(q.available!==true||q.seller_enabled!==true||q.supported_currency!==listing.price.currency||
     typeof q.provider_terms_url!=='string'||!/^https:\/\//.test(q.provider_terms_url)||
     !HASH.test(q.provider_terms_sha256||''))fail('RAIL_VERIFICATION_REQUIRED');
  observed(q.observed_at,'RAIL_QUOTE',ms);
  const railFee=cents(q.total_fee_cents,'RAIL_FEE');
  // A rail may be noncustodial, but that is NOT evidence of licensing exemption.
  const provenance={source:'OPERATOR_VERIFIED_PROVIDER_QUOTE_NOT_REVALIDATED_HERE',
   observed_at:q.observed_at,terms_url:q.provider_terms_url,terms_sha256:q.provider_terms_sha256};
  offers.push({code,rail_fee_cents:railFee,
    platform_fee_cents:fee,
    quoted_total_fees_cents:railFee+fee,
    gross_item_shipping_cents:total,
    seller_before_shipping_and_costs_cents:total-railFee-fee,
    provenance,
    payment_status:'NOT_INITIATED',provider_onboarding:'NOT_VERIFIED_BY_THIS_MODULE'});
 }
 offers.sort((a,b)=>a.quoted_total_fees_cents-b.quoted_total_fees_cents||a.code.localeCompare(b.code));
 const base={
  schema:'dreamledger/777-payment-choice-quote/v1',
  listing_id:listing.listing_id,silo_id:silo,actor_kind:caller,actor_id:actorId,
  item_price_minor:unit,quantity,shipping_minor:shipping,currency:listing.price.currency,
  gross_minor:total,fee_policy_bps:platformBps,payment_options:offers,
  authority_status:authority,action_status:'QUOTE_ONLY_NOT_PAYABLE',
  payment_status:'NOT_INITIATED',settlement_verified:false,
  fulfillment_verified:false,delivery_verified:false,
  legal_review:'REQUIRED_FOR_PROTECTION_ESCROW_OR_AGENT_SETTLEMENT',
  observed_at:now,
  requires:['SIGNED_GAUNTLET_ALLOCATION','PROVIDER_ONBOARDING','ACTUAL_SETTLEMENT_PROOF',
    'ATOMIC_IDEMPOTENCY_QUOTA','AUTHENTICATED_ACCOUNT_AND_INVENTORY',
    'PAYMENT_EXECUTION_SEPARATELY_AUTHORIZED']
 };
 return {...base,sha256:digest(base)};
}
export function checkQuoteIntegrity(quote){
 if(!quote||quote.schema!=='dreamledger/777-payment-choice-quote/v1')return false;
 const {sha256,...base}=quote;
 return typeof sha256==='string'&&HASH.test(sha256)&&digest(base)===sha256 &&
  quote.action_status==='QUOTE_ONLY_NOT_PAYABLE'&&quote.settlement_verified===false;
}
