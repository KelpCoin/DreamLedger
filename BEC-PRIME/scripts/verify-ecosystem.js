'use strict';
const fs=require('fs');
const path=require('path');
const root=path.join(__dirname,'..');
const file=path.join(root,'data','ecosystem_manifest.json');
const m=JSON.parse(fs.readFileSync(file,'utf8'));
const checks=[
 ['SCHEMA',m.schema==='dreamledger/ecosystem/v1'],
 ['DOOH_CONTRACTED_NOT_LIVE',m.rails.programmatic_dooh.status==='CONTRACTED_NOT_LIVE'&&m.rails.programmatic_dooh.live_purchase===false],
 ['AVATAR_ACCOUNT_BOUND',m.rails.avatar_ecosystem.status==='IMPLEMENTED'&&m.rails.avatar_ecosystem.identity==='account-bound'],
 ['AGENT_COMMERCE_GATED',m.rails.agentic_commerce.status==='IMPLEMENTED_GATED'&&m.rails.agentic_commerce.agent_checkout_open===false],
 ['MARKETPLACE_CORE',m.rails.marketplace.status==='IMPLEMENTED_CORE'],
 ['TRUTH_ZERO',m.truth_policy.verified_revenue_nzd===0&&m.truth_policy.external_buyer_verified===false],
 ['AUTHORITY_GATE',m.authority.human_authorization_required===true&&m.authority.agent_may_execute_external_media_buy===false]
];
const failed=checks.filter(x=>!x[1]).map(x=>x[0]);
const proof={schema:'dreamledger/ecosystem-verification/v1',generated_at:new Date().toISOString(),verdict:failed.length?'FAIL':'PASS',checks:Object.fromEntries(checks),failed};
console.log(JSON.stringify(proof,null,2));
process.exit(failed.length?1:0);
