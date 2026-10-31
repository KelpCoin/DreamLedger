'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
// Read-only admission gate. No provider API calls, checkout changes or publication.
const ref=v=>typeof v==='string' && /^(https:\/\/|github:|stripe:|proof:|sha256:)[^\s]+$/.test(v) && v.length<=2048;
function evaluate(c){
 if(!c || typeof c!=='object' || Array.isArray(c)) throw new TypeError('Candidate must be an object');
 const checks=[];
 const add=(id,pass,reason)=>checks.push({id,status:pass?'PASS':'BLOCKED',reason});
 const d=c.demand||{},r=c.rights||{},p=c.privacy||{},e=c.economics||{},f=c.fulfillment||{},a=c.publication||{};
 add('verified_demand',d.independent_buyer===true && ref(d.buyer_request_ref),'Buyer-initiated evidence required');
 add('reusable_rights',r.original_work===true && r.third_party_material==='excluded' && ref(r.attestation_ref),'Original work, third-party exclusion and rights proof required');
 add('silo_and_privacy',p.customer_data==='excluded' && p.silo_review==='passed' && ref(p.review_ref),'Privacy exclusion and silo review required');
 add('verified_price',Number.isFinite(e.price_nzd) && e.price_nzd>0 && ref(e.price_ref),'Positive price and provider reference required');
 const contribution=e.price_nzd-e.variable_cost_nzd-e.operator_minutes*e.labour_rate_nzd_hour/60;
 add('positive_contribution',Number.isFinite(e.variable_cost_nzd)&&e.variable_cost_nzd>=0 && Number.isFinite(e.operator_minutes)&&e.operator_minutes>=0 && Number.isFinite(e.labour_rate_nzd_hour)&&e.labour_rate_nzd_hour>0 && Number.isFinite(contribution)&&contribution>0 && ref(e.measured_cost_ref),'Measured direct costs, labour and positive contribution required');
 add('unattended_delivery',f.unattended_test_passed===true && f.delivery_receipt_tested===true && ref(f.test_ref),'Unattended delivery and receipt test required');
 add('human_approval',a.approved===true && ref(a.approval_ref),'Independent recorded approval required');
 return {schema:'beck/self-service-readiness/v1',verdict:checks.every(x=>x.status==='PASS')?'READY_FOR_HUMAN_RELEASE_REVIEW':'HOLD',checkout_enabled_by_this_tool:false,publication_performed:false,candidate_sha256:crypto.createHash('sha256').update(JSON.stringify(c)).digest('hex'),checks};
}
if(require.main===module){
 const [input,output]=process.argv.slice(2);
 if(!input||!output){console.error('Usage: node self-service-readiness.cjs candidate.json proof.json');process.exit(2);}
 try{const p=evaluate(JSON.parse(fs.readFileSync(input,'utf8')));fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(p,null,2)+'\n');console.log(p.verdict);process.exitCode=p.verdict==='HOLD'?1:0;}
 catch(e){console.error(e.message);process.exitCode=2;}
}
module.exports={evaluate};
