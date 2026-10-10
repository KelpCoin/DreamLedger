'use strict';
const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..');
const checks=[
 ['A2A_SCHEMA',fs.existsSync(path.join(root,'..','data','schema','a2a-marketplace-v1.json'))],
 ['A2A_AGENT_CARD',fs.existsSync(path.join(root,'..','public','marketplace','agent-card.json'))],
 ['A2A_UI',fs.existsSync(path.join(root,'..','public','a2a-marketplace.html'))],
 ['M2M_ROUTE',fs.existsSync(path.join(root,'routes','m2m.js'))],
 ['M2M_PRELOAD',fs.existsSync(path.join(root,'lib','m2mPreload.js'))]
];
const text=fs.readFileSync(path.join(root,'routes','m2m.js'),'utf8');
for(const route of ['/m2m/v1/marketplace/manifest','/m2m/v1/marketplace/capabilities','/m2m/v1/marketplace/search','/m2m/v1/marketplace/quote','/m2m/v1/marketplace/authorize','/m2m/v1/marketplace/orders']) checks.push(['ROUTE_'+route.split('/').pop().toUpperCase(),text.includes(route)]);
const m2m=fs.readFileSync(path.join(root,'routes','m2m.js'),'utf8');
const a2a=fs.readFileSync(path.join(root,'..','public','a2a-marketplace.html'),'utf8');
checks.push(['QUOTE_HMAC_SIGNING',m2m.includes('M2M_QUOTE_SIGNING_SECRET')&&m2m.includes('crypto.createHmac')&&m2m.includes('crypto.timingSafeEqual')]);
checks.push(['QUOTE_EXPIRY_ENFORCED',m2m.includes('Date.now()-issuedAt>900000')]);
checks.push(['A2A_UI_CALLS_EXISTING_CHECKOUT',a2a.includes("api('/api/checkout/create'")&&a2a.includes('window.location.assign(checkout.checkout_url)')]);
checks.push(['A2A_UI_CHECKS_QUOTE_PRICE',a2a.includes('Price changed since quote')]);
checks.push(['A2A_AUTHENTICATED_HUMAN',m2m.includes('authorizedHuman(req)')&&m2m.includes('AUTHENTICATED_HUMAN_REQUIRED')&&m2m.includes('email_confirmed_at')]);
checks.push(['A2A_AUTH_UI',a2a.includes('humanSignIn')&&a2a.includes('humanSignUp')&&a2a.includes('state.session.access_token')]);
checks.push(['A2A_OFFLINE_TESTS',fs.existsSync(path.join(root,'scripts','test-a2a-marketplace.js'))]);
const failed=checks.filter(x=>!x[1]).map(x=>x[0]);
const proof={schema:'dreamledger/a2a-marketplace-contract/v1',generated_at:new Date().toISOString(),verdict:failed.length?'FAIL':'PASS',checks:Object.fromEntries(checks),failed,economic_truth:'A2A discovery, quotes and orders are not revenue. VERIFIED requires settled external payment, fulfillment and independent evidence.'};
const out=path.join(root,'data','proofs','A2A-MARKETPLACE-CONTRACT-PROOF.json');fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof,null,2));process.exit(failed.length?1:0);
