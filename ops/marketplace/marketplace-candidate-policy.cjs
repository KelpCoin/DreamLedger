'use strict';
// CANDIDATE ONLY: deterministic commerce rules for the existing DreamLedger
// B2B / peer online bidding / A2A surfaces. No charging or publication authority.
const {createHash}=require('node:crypto');
const TIERS=Object.freeze({
 B2B:Object.freeze({listing_fee_minor:0,success_fee_bps:0,agent_discovery_fee_minor:0}),
 P2P:Object.freeze({listing_fee_minor:0,success_fee_bps:100,max_success_fee_minor:500}),
 A2A:Object.freeze({discovery_fee_minor:0,billable_action_minor:10,monthly_invoice_minimum_minor:1000})
});
const MODES=new Set(['B2B','P2P','A2A']);
const MARKETS=new Set(['NZ','GLOBAL']);
const DISALLOWED=/\b(?:human\s+being|buy\s+(?:a\s+)?person|sell\s+(?:a\s+)?person|traffick?ing|forced\s+labor|slave\s+(?:sale|auction)|weapons?|firearms?|prescription\s+drugs?)\b/i;
function refuse(code){const e=new Error(code);e.code=code;throw e}
function string(v,min,max,code){
 if(typeof v!=='string')refuse(code);
 const x=v.trim().replace(/\s+/g,' ');
 if(x.length<min||x.length>max||/[\u0000-\u001f\u007f]/.test(x))refuse(code);
 return x;
}
function amount(n){if(!Number.isSafeInteger(n)||n<0||n>10000000000)refuse('AMOUNT_MINOR_INVALID');return n}
function feePreview(kind,amountMinor,opts={}){
 if(!MODES.has(kind))refuse('LANE_UNSUPPORTED');
 const cents=amount(amountMinor), p=TIERS[kind];
 if(kind==='B2B')return {kind,currency:'NZD',listing_fee_minor:0,success_fee_minor:0,processor_fees_extra:true,nonbinding:true};
 if(kind==='P2P')return {kind,currency:'NZD',listing_fee_minor:0,
   success_fee_minor:Math.min(p.max_success_fee_minor,Math.floor((cents*p.success_fee_bps+9999)/10000)),
   processor_fees_extra:true,nonbinding:true};
 return {kind,currency:'NZD',discovery_fee_minor:0,
   per_approved_fulfilled_job_minor:p.billable_action_minor,
   monthly_invoice_minimum_minor:p.monthly_invoice_minimum_minor,
   processor_fees_extra:true,nonbinding:true};
}
function listingDraft(input,caller){
 if(!input||typeof input!=='object'||Array.isArray(input))refuse('LISTING_INPUT_INVALID');
 if(!caller||typeof caller!=='object'||caller.verified!==true||
   typeof caller.principal_id!=='string'||caller.principal_id.length<5)refuse('IDENTITY_NOT_VERIFIED');
 const lane=string(input.lane,3,3,'LANE_INVALID').toUpperCase();
 if(!MODES.has(lane))refuse('LANE_UNSUPPORTED');
 const market=string(input.market,2,6,'MARKET_INVALID').toUpperCase();
 if(!MARKETS.has(market))refuse('MARKET_UNSUPPORTED');
 const title=string(input.title,3,120,'TITLE_INVALID');
 const description=string(input.description,15,4000,'DESCRIPTION_INVALID');
 const category=string(input.category,2,80,'CATEGORY_INVALID');
 if(DISALLOWED.test([title,description,category].join(' ')))refuse('RESTRICTED_LISTING_HOLD');
 if(input.actor_type==='human_sale')refuse('HUMAN_SALE_REFUSED');
 if(input.trader_status!=='in_trade'&&input.trader_status!=='private')refuse('TRADER_STATUS_REQUIRED');
 if(input.rights_confirmed!==true)refuse('RIGHTS_CONFIRMATION_REQUIRED');
 const priceMinor=amount(input.price_minor);
 if(priceMinor<100)refuse('PRICE_BELOW_SAFE_MINIMUM');
 const delivery=string(input.delivery_region,2,80,'DELIVERY_REGION_REQUIRED');
 if(market==='NZ'&&!/NZ|NEW ZEALAND/i.test(delivery))refuse('NZ_DELIVERY_REGION_REQUIRED');
 const data={schema:'BECK/MARKETPLACE-CANDIDATE/v1',
   lane,market,silo:'SILO_MARKETPLACE',seller_principal_id:caller.principal_id,
   trader_status:input.trader_status,title,description,category,
   price_minor:priceMinor,currency:'NZD',delivery_region:delivery,
   rights_confirmed:true,listing_status:'DRAFT',
   gauntlet_verdict:'PENDING',approval_required:true,
   public_listing:false,bidding_enabled:false,checkout_enabled:false,
   automatic_publication:false,agent_execution:'NOT_DISPATCHED',
   fulfillment_status:'NOT_STARTED',revenue_evidence:null};
 return {...data,candidate_sha256:createHash('sha256').update(JSON.stringify(data)).digest('hex')};
}
function bidGate({actor_id,seller_id,amount_minor,min_bid_minor,verified,approved,
 end_time_ms,now_ms,has_paid_bid_authority,agent_delegation_approved}){
 if(verified!==true||approved!==true)refuse('AUTH_OR_GAUNTLET_HOLD');
 if(!actor_id||!seller_id||actor_id===seller_id)refuse('SELF_BID_FORBIDDEN');
 if(!has_paid_bid_authority)refuse('BID_AUTHORITY_REQUIRED');
 if(agent_delegation_approved===false)refuse('AGENT_DELEGATION_HOLD');
 amount(amount_minor);amount(min_bid_minor);
 if(amount_minor<min_bid_minor)refuse('BID_BELOW_MINIMUM');
 if(!Number.isFinite(now_ms)||!Number.isFinite(end_time_ms)||now_ms>=end_time_ms)refuse('AUCTION_ENDED');
 return {verdict:'ALLOW_BID_CANDIDATE',payment_status:'NOT_SETTLED',revenue_evidence:null};
}
module.exports={TIERS,feePreview,listingDraft,bidGate};
