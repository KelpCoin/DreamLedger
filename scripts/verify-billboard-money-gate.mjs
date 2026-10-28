#!/usr/bin/env node
/**
 * BECK money gate: read-only live public offer vs Stripe payment-link audit.
 * Detect drift before distribution; never alter Stripe, public pages, or posts.
 */
import {writeFile, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dirname} from 'node:path';

export const LINK_IDS=Object.freeze([
  'plink_1UCrekEGgEAnUFF9XVRM04aG',
  'plink_1U9JGTEGgEAnUFF9WRg3CKk3'
]);
export const LIVE_PAGE='https://dreamledger.org/billboard';
const digest=x=>createHash('sha256').update(x).digest('hex');
function timeoutSignal(ms=12000){return AbortSignal.timeout(ms)}
export function classify(html,links) {
  const held=/Checkout temporarily held|checkout held|New purchases are paused|Payment intake currently held/i.test(html);
  const checkoutOpen=/Reserve a tile securely|href=["']https:\/\/buy\.stripe\.com\//i.test(html) && !held;
  const knownLinks=links.filter(x=>x.known);
  const active=knownLinks.filter(x=>x.active===true);
  const stripeComplete=knownLinks.length===LINK_IDS.length;
  const contradictory=held&&active.length>0;
  let verdict;
  if(contradictory) verdict='HOLD_ACTIVE_LINKS_WHILE_PUBLIC_OFFER_HELD';
  else if(held) verdict='HOLD_PUBLIC_OFFER';
  else if(!stripeComplete) verdict='UNVERIFIED_PAYMENT_LINKS';
  else if(!checkoutOpen) verdict='HOLD_NO_VALIDATED_CHECKOUT';
  else verdict='REVIEW_REQUIRED_NOT_DELIVERY_PROOF';
  return {
    verdict,held,checkoutOpen,stripeLinksChecked:knownLinks.length,
    activeLinkedPayments:active.length,contradictory,
    deploymentVerified:false,fulfillmentVerified:false,
    authorizedToResumeCampaign:false,publicationAllowed:false,
    verifiedExternalRevenueNzd:null
  };
}
async function readOffer() {
 const r=await fetch(LIVE_PAGE,{headers:{accept:'text/html'},signal:timeoutSignal(),redirect:'follow'});
 if(!r.ok)throw new Error('PUBLIC_OFFER_HTTP_'+r.status);
 if(new URL(r.url).hostname!=='dreamledger.org')throw new Error('OFFER_REDIRECT_HOST_REFUSED');
 const len=Number(r.headers.get('content-length')||0);
 if(len>400000)throw new Error('OFFER_SIZE_REFUSED');
 const text=await r.text();
 if(text.length>400000)throw new Error('OFFER_SIZE_REFUSED');
 return text;
}
async function readPaymentLink(id,key){
 if(!/^plink_[A-Za-z0-9]+$/.test(id))throw new Error('LINK_ID_REFUSED');
 const r=await fetch('https://api.stripe.com/v1/payment_links/'+encodeURIComponent(id),{
   headers:{authorization:'Bearer '+key},signal:timeoutSignal()});
 if(!r.ok)return {id,known:false,reason:'HTTP_'+r.status};
 const j=await r.json();
 return {id,known:j.id===id&&j.livemode===true,active:j.active===true,
   live:j.livemode===true};
}
async function main(){
 const path=process.env.BECK_GATE_OUTPUT||'proof/commerce/billboard-money-gate.json';
 let html='',links=[],errorClass=null;
 try{html=await readOffer()}catch(e){errorClass=String(e.message||e).slice(0,100)}
 const key=String(process.env.STRIPE_SECRET_KEY||'');
 if(/^sk_live_/.test(key)){
   for(const id of LINK_IDS){
     try{links.push(await readPaymentLink(id,key))}
     catch(e){links.push({id,known:false,reason:'LINK_READ_FAILED'})}
   }
 }else{
   links=LINK_IDS.map(id=>({id,known:false,reason:'STRIPE_READ_CREDENTIAL_UNAVAILABLE'}));
 }
 const outcome=errorClass?{
  verdict:'HOLD_LIVE_PUBLIC_OFFER_UNREACHABLE',held:null,checkoutOpen:null,
  stripeLinksChecked:links.filter(x=>x.known).length,
  activeLinkedPayments:links.filter(x=>x.known&&x.active).length,
  contradictory:null,deploymentVerified:false,fulfillmentVerified:false,
  authorizedToResumeCampaign:false,publicationAllowed:false,
  verifiedExternalRevenueNzd:null,
 }:classify(html,links);
 const report={schema:'BECK/BILLBOARD-MONEY-GATE/v1',
   observedAtUtc:new Date().toISOString(),
   liveOffer:LIVE_PAGE,htmlSha256:html?digest(html):null,
   stripeLinks:links,...outcome,reason:errorClass};
 const bytes=Buffer.from(JSON.stringify(report,null,2)+'\n');
 await mkdir(dirname(path),{recursive:true});
 await writeFile(path,bytes,{mode:0o600});
 await writeFile(path+'.sha256',digest(bytes)+'  '+path.split('/').pop()+'\n');
 console.log(JSON.stringify({verdict:report.verdict,reason:report.reason,
   checked:report.stripeLinksChecked,active:report.activeLinkedPayments,
   proof:path,verifiedExternalRevenueNzd:null}));
 if(process.env.GITHUB_STEP_SUMMARY)await writeFile(process.env.GITHUB_STEP_SUMMARY,
   '\nBECK Billboard money gate: **'+report.verdict+'**. Read-only proof: '+path+
   '. This is not buyer/payment/delivery proof.\n',{flag:'a'});
 // HOLD is a real gate, not a successful commercial closure. CI artifacts retained.
}
if(import.meta.url===new URL('file://'+process.argv[1]).href){
 main().catch(e=>{console.error('BECK_MONEY_GATE_ERROR',e.message);process.exitCode=1})
}
