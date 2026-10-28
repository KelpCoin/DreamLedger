'use strict';
const crypto=require('node:crypto');
const LANES=Object.freeze({
 b2b:{basic_listing_fee_minor:0,commission_bps:0,allowed_actions:['DRAFT_LISTING','DRAFT_RFQ','SEARCH']},
 p2p:{basic_listing_fee_minor:0,commission_bps:100,allowed_actions:['DRAFT_LISTING','SEARCH','PROPOSE_BID']},
 a2a:{basic_listing_fee_minor:0,commission_bps:0,allowed_actions:['SEARCH','QUOTE','DRAFT_ORDER']}
});
const COUNTRY=/^[A-Z]{2}$/;
function deny(code){return Object.freeze({decision:'HOLD',reason:code,production_mutation:false,public_action:false,payment_action:false})}
function assess(input={}){
 if(!Object.prototype.hasOwnProperty.call(LANES,input.lane))return deny('UNKNOWN_MARKETPLACE_LANE');
 const lane=LANES[input.lane];
 if(!COUNTRY.test(String(input.country||'')))return deny('COUNTRY_REQUIRED_ISO2');
 if(!['NZD','AUD','USD','EUR','GBP'].includes(String(input.currency||'')))return deny('CURRENCY_UNSUPPORTED');
 if(input.silo!=='SILO_MARKETPLACE_'+input.lane.toUpperCase())return deny('SILO_BOUNDARY_REFUSED');
 if(!lane.allowed_actions.includes(input.action))return deny('ACTION_NOT_ALLOWED');
 if(input.action==='PROPOSE_BID' && (!input.seller_verified||!input.bidder_verified))return deny('BIDDING_IDENTITY_NOT_VERIFIED');
 if(input.action==='DRAFT_ORDER' && !input.agent_authority_verified)return deny('AGENT_AUTHORITY_REQUIRED');
 if(input.requires_payment||input.requires_publication)return deny('EXTERNAL_ACTION_APPROVAL_REQUIRED');
 if(input.action==='DRAFT_LISTING' && input.seller_in_trade!==true&&input.seller_in_trade!==false)return deny('TRADER_DISCLOSURE_REQUIRED');
 return Object.freeze({decision:'DRAFT_ONLY',reason:'PREVIEW_ALLOWED_NO_EXTERNAL_SIDE_EFFECTS',
  production_mutation:false,public_action:false,payment_action:false,
  lane:input.lane,market:input.country,currency:input.currency,
  pricing:{basic_listing_fee_minor:lane.basic_listing_fee_minor,
           indicative_seller_fee_bps:lane.commission_bps,fee_finalized:false}});
}
const sha=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
function receipt(input){
 const result=assess(input);
 const body={schema:'BECK/MULTILANE-MARKETPLACE-POLICY/v1',input_sha256:sha(input),
  ...result,actual_bid_placed:false,external_buyer_verified:false,settlement_verified:false};
 return {...body,sha256:sha(body)};
}
module.exports={LANES,assess,receipt};
