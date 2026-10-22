'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const contract=require('../docs/commerce/commerce-sku-contract.v1.json');
const secret=process.env.STRIPE_SECRET_KEY;
const targets=[
 {id:process.env.COMMANDER_DIAGNOSTIC_PAYMENT_LINK_ID||'plink_1UKS00EGgEAnUFF9kUjraaL5',offer:'CMD-DIAG-29',expected:contract.offer_mappings['CMD-DIAG-29'],must_be_active:true},
 {id:process.env.TOLL_PROBE_PAYMENT_LINK_ID||'plink_1UNpw7EGgEAnUFF9yLItVlyv',offer:'TOLL-PROBE-50C',expected:'TOLL-PROBE-50C',must_be_active:true}
];
function resolve(metadata={}) {
 for(const key of contract.key_priority) {
  const value=metadata[key];
  if(typeof value==='string'&&value.trim()) {
   const raw=value.trim();
   return {key,raw_value:raw,resolved_value:key==='marketplace_listing_id'?raw:(contract.offer_mappings[raw]||raw)};
  }
 }
 return null;
}
async function getLink(id) {
 const response=await fetch('https://api.stripe.com/v1/payment_links/'+encodeURIComponent(id),{headers:{authorization:'Bearer '+secret,accept:'application/json'}});
 const body=await response.json().catch(()=>({}));
 if(!response.ok) throw new Error('Stripe read failed HTTP '+response.status+'; response body suppressed');
 return body;
}
async function main() {
 const started=new Date().toISOString();
 if(!secret) throw new Error('STRIPE_SECRET_KEY is required; no secret is logged.');
 const rows=[];
 for(const target of targets) {
  const link=await getLink(target.id);
  const metadata=link.metadata||{};
  const resolution=resolve(metadata);
  const violations=[];
  if(link.active!==true&&target.must_be_active) violations.push('LINK_INACTIVE');
  if(!resolution) violations.push('NO_ALLOWED_IDENTIFIER_KEY');
  if(resolution && resolution.raw_value!==target.expected) violations.push('CANONICAL_VALUE_MISMATCH');
  rows.push({
   payment_link_id:link.id,offer:target.offer,active:link.active===true,livemode:link.livemode===true,
   url:link.url||null,metadata_before:metadata,metadata_after:metadata,mutation_performed:false,
   resolved_key:resolution?resolution.key:null,resolved_value:resolution?resolution.resolved_value:null,
   expected_canonical_value:target.expected,violations,result:violations.length?'FAIL':'PASS'
  });
 }
 const failures=rows.filter(row=>row.violations.length);
 const result=failures.length?'FAIL':'PASS';
 const fossil={
  schema:contract.schema,action:'live_payment_link_sku_regression',mode:'READ_ONLY_LIVE_STRIPE',
  started_at_utc:started,finished_at_utc:new Date().toISOString(),link_count:rows.length,
  links:rows,violation_count:failures.length,result,
  evidence_boundary:'Read-only Stripe Payment Link metadata inspection. No link was created, updated, activated, or deactivated.'
 };
 const out=path.join(process.cwd(),'proof','commerce','sku-live-link-audit-latest.json');
 await fs.mkdir(path.dirname(out),{recursive:true});
 await fs.writeFile(out,JSON.stringify(fossil,null,2)+'\n',{mode:0o600});
 console.log(JSON.stringify({artifact:out,link_count:rows.length,violation_count:failures.length,result},null,2));
 if(result!=='PASS') process.exitCode=1;
}
main().catch(async error=>{
 const out=path.join(process.cwd(),'proof','commerce','sku-live-link-audit-latest.json');
 const fossil={schema:contract.schema,action:'live_payment_link_sku_regression',mode:'READ_ONLY_LIVE_STRIPE',timestamp:new Date().toISOString(),result:'FAIL',reason:String(error.message||error),evidence_boundary:'Read-only audit. No live Stripe object was changed.'};
 await fs.mkdir(path.dirname(out),{recursive:true});
 await fs.writeFile(out,JSON.stringify(fossil,null,2)+'\n',{mode:0o600});
 console.error(JSON.stringify({result:'FAIL',reason:fossil.reason,artifact:out}));
 process.exitCode=1;
});
