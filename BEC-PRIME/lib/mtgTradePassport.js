'use strict';
/* Private, opt-in two-person trade passport. Tokens are bearer capabilities,
 * not identity proof. The ledger NEVER certifies payment, delivery, or trust.
 * No government names, addresses, emails or phone numbers are stored here.
 */
const crypto=require('node:crypto');
const ID=/^trade_[a-f0-9]{32}$/;
const RATING=new Set(['positive','neutral','negative']);
const STATUS=new Set(['AWAITING_COUNTERPARTY','AWAITING_AGREEMENT','AGREED','AWAITING_COMPLETION','PEER_REPORTED_COMPLETE','DISPUTED']);
function clean(v,max=200){
 const s=String(v==null?'':v).normalize('NFKC').trim().slice(0,max);
 if(/[\x00-\x1F\x7F\u202A-\u202E]/.test(s))throw new Error('INVALID_CONTROL_CHARACTERS');
 return s;
}
function sha(v){return crypto.createHash('sha256').update(v).digest('hex');}
function stable(value){
 if(Array.isArray(value))return '['+value.map(stable).join(',')+']';
 if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stable(value[k])).join(',')+'}';
 return JSON.stringify(value);
}
function token(){return crypto.randomBytes(32).toString('hex');}
function trustedDigest(present,stored){
 if(typeof present!=='string'||!/^[a-f0-9]{64}$/.test(present)||typeof stored!=='string'||!/^[a-f0-9]{64}$/.test(stored))return false;
 return crypto.timingSafeEqual(Buffer.from(sha(present),'hex'),Buffer.from(stored,'hex'));
}
function append(record,eventType,detail){
 const previous=record.events.length?record.events.at(-1).hash:'0'.repeat(64);
 const seq=record.events.length+1;
 const content={seq,event_type:eventType,detail,previous_hash:previous};
 record.events.push({...content,hash:sha(stable(content))});
 return record;
}
function verifyChain(record){
 if(!record||!Array.isArray(record.events)||!record.events.length)return false;
 let prev='0'.repeat(64);
 for(let i=0;i<record.events.length;i++){
   const e=record.events[i];
   const core={seq:e.seq,event_type:e.event_type,detail:e.detail,previous_hash:e.previous_hash};
   if(e.seq!==i+1||e.previous_hash!==prev||sha(stable(core))!==e.hash)return false;
   prev=e.hash;
 }
 return true;
}
function fresh(input){
 if(!input||typeof input!=='object')throw new Error('INVALID_TRADE');
 const seller=clean(input.seller_handle,60);
 const terms=clean(input.terms,1600);
 const side=clean(input.seller_offers,600);
 const wanted=clean(input.seller_wants,600);
 if(!seller||!side||!wanted)throw new Error('HANDLE_AND_TWO_SIDES_REQUIRED');
 if(!terms)throw new Error('TERMS_REQUIRED');
 const sellerSecret=token(),invite=token();
 const record={
   schema:'BECK/MTG-TWO-PERSON-TRADE/v1',
   trade_id:'trade_'+crypto.randomBytes(16).toString('hex'),
   silo:'mtg',status:'AWAITING_COUNTERPARTY',
   seller_handle:seller,buyer_handle:null,
   seller_offers:side,seller_wants:wanted,terms,
   fee_nzd:0,payment_platform:'DIRECT_BETWEEN_PARTIES',
   verification:'PEER_ATTESTED_ONLY',
   seller_token_hash:sha(sellerSecret),invite_token_hash:sha(invite),
   buyer_token_hash:null,
   approvals:{seller:false,buyer:false},
   completion:{seller:false,buyer:false},
   feedback:{seller:null,buyer:null},
   events:[],
 };
 append(record,'CREATED',{seller_handle:seller,terms_sha256:sha(terms),seller_offers_sha256:sha(side),seller_wants_sha256:sha(wanted)});
 return {record,seller_token:sellerSecret,invitation_token:invite};
}
function need(record){if(!record||!ID.test(record.trade_id)||record.silo!=='mtg'||!verifyChain(record))throw new Error('UNTRUSTED_TRADE_RECORD');}
function role(record,role,secret){
 need(record);
 const digest=role==='seller'?record.seller_token_hash:role==='buyer'?record.buyer_token_hash:null;
 if(!digest||!trustedDigest(secret,digest))throw new Error('INVALID_ROLE_CAPABILITY');
 return role;
}
function join(record,invitation,handle){
 need(record);
 if(record.status!=='AWAITING_COUNTERPARTY'||record.buyer_token_hash)throw new Error('COUNTERPARTY_ALREADY_JOINED');
 if(!trustedDigest(invitation,record.invite_token_hash))throw new Error('INVALID_INVITE');
 const buyer=clean(handle,60);
 if(!buyer||buyer.toLowerCase()===record.seller_handle.toLowerCase())throw new Error('DISTINCT_TRADING_HANDLES_REQUIRED');
 const buyerSecret=token();
 record.buyer_handle=buyer;record.buyer_token_hash=sha(buyerSecret);
 record.invite_token_hash=null;record.status='AWAITING_AGREEMENT';
 append(record,'BUYER_JOINED',{buyer_handle:buyer});
 return {record,buyer_token:buyerSecret};
}
function agree(record,participant,secret){
 role(record,participant,secret);
 if(record.status!=='AWAITING_AGREEMENT'&&record.status!=='AGREED')throw new Error('TRADE_NOT_OPEN_FOR_AGREEMENT');
 if(record.approvals[participant])throw new Error('ALREADY_AGREED');
 record.approvals[participant]=true;
 append(record,'PARTY_AGREED',{role:participant});
 if(record.approvals.seller&&record.approvals.buyer)record.status='AGREED';
 return record;
}
function done(record,participant,secret){
 role(record,participant,secret);
 if(record.status!=='AGREED'&&record.status!=='AWAITING_COMPLETION')throw new Error('TRADE_NOT_AGREED');
 if(record.completion[participant])throw new Error('COMPLETION_ALREADY_RECORDED');
 record.completion[participant]=true;
 append(record,'PARTY_REPORTED_COMPLETED',{role:participant});
 record.status=record.completion.seller&&record.completion.buyer?'PEER_REPORTED_COMPLETE':'AWAITING_COMPLETION';
 return record;
}
function feedback(record,participant,secret,rating,comment){
 role(record,participant,secret);
 if(record.status!=='PEER_REPORTED_COMPLETE')throw new Error('BOTH_PARTIES_MUST_REPORT_COMPLETE_FIRST');
 if(record.feedback[participant])throw new Error('ONE_FEEDBACK_PER_SIDE');
 if(!RATING.has(rating))throw new Error('INVALID_RATING');
 const note=clean(comment,350);
 if(/https?:\/\//i.test(note)||/@|\b\+?\d{8,}\b/.test(note))throw new Error('CONTACT_DETAILS_NOT_ALLOWED_IN_FEEDBACK');
 record.feedback[participant]={rating,comment:note,visibility:'PRIVATE_UNVERIFIED'};
 append(record,'PEER_FEEDBACK',{role:participant,rating,comment_sha256:sha(note)});
 return record;
}
function view(record,participant,secret){
 role(record,participant,secret);
 // Returns only the chosen role's feedback until mutual feedback completed,
 // preventing retaliation based on the other person's score.
 const allFeedback=!!record.feedback.seller&&!!record.feedback.buyer;
 return {
   trade_id:record.trade_id,silo:'mtg',status:record.status,
   seller_handle:record.seller_handle,buyer_handle:record.buyer_handle,
   seller_offers:record.seller_offers,seller_wants:record.seller_wants,terms:record.terms,
   approvals:{...record.approvals},completion:{...record.completion},
   feedback:allFeedback?{seller:record.feedback.seller,buyer:record.feedback.buyer}:
     {[participant]:record.feedback[participant]},
   two_person_ledger_hash:record.events.at(-1).hash,
   two_person_ledger_events:record.events.length,
   trust_label:'PEER_ATTESTED_NOT_INDEPENDENTLY_VERIFIED',
   reputation_credit:0,verified_revenue_nzd:0,platform_fee_nzd:0,
   government_name:null,identity_verified:false
 };
}
module.exports={fresh,join,agree,done,feedback,view,verifyChain,ID};
