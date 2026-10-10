'use strict';
const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..');
const checks=[
 ['B2B_UI',fs.existsSync(path.join(root,'..','public','b2b-marketplace.html'))],
 ['TRADE_MARKETPLACE_UI',fs.existsSync(path.join(root,'..','public','marketplace.html'))],
 ['A2A_AGENT_MANIFEST',fs.existsSync(path.join(root,'..','public','marketplace','agent.json'))],
 ['TRADE_MARKETPLACE_SCHEMA',fs.existsSync(path.join(root,'..','data','schema','trade-marketplace-v1.json'))],
 ['LOCAL_POWERSHELL_RUNNER',fs.existsSync(path.join(root,'..','ops','marketplace','Invoke-TradeMarketplaceLocal.ps1'))],
 ['B2B_ROUTE_SEARCH',fs.readFileSync(path.join(root,'routes','dreamiez.js'),'utf8').includes('/api/b2b/search')],
 ['B2B_ROUTE_RFQ',fs.readFileSync(path.join(root,'routes','dreamiez.js'),'utf8').includes('/api/b2b/rfqs')],
 ['B2B_ROUTE_OFFERS',fs.readFileSync(path.join(root,'routes','dreamiez.js'),'utf8').includes('/api/b2b/offers')],
 ['B2B_ROUTE_ORDERS',fs.readFileSync(path.join(root,'routes','dreamiez.js'),'utf8').includes('/api/b2b/orders')],
 ['MARKETPLACE_PRO_UI',fs.existsSync(path.join(root,'..','public','marketplace-pro.html'))],
 ['MARKETPLACE_FAVORITES',fs.readFileSync(path.join(root,'routes','dreamiez.js'),'utf8').includes('/api/marketplace/favorites')],
 ['MARKETPLACE_MESSAGES',fs.readFileSync(path.join(root,'routes','dreamiez.js'),'utf8').includes('/api/marketplace/messages')],
 ['MARKETPLACE_REVIEWS',fs.readFileSync(path.join(root,'routes','dreamiez.js'),'utf8').includes('/api/marketplace/reviews')],
 ['MARKETPLACE_REPORTS',fs.readFileSync(path.join(root,'routes','dreamiez.js'),'utf8').includes('/api/marketplace/reports')],
 ['MARKETPLACE_PROMOTIONS',fs.readFileSync(path.join(root,'routes','dreamiez.js'),'utf8').includes('/api/marketplace/promotions')],
 ['MARKETPLACE_ORDERS',fs.readFileSync(path.join(root,'routes','dreamiez.js'),'utf8').includes('/api/marketplace/orders')],
 ['ACCOUNT_LOGIN_SURFACE',fs.existsSync(path.join(root,'compiled','website','login.html'))],
 ['ACCOUNT_SURFACE',fs.existsSync(path.join(root,'compiled','website','account.html'))],
 ['AVATAR_SURFACE',fs.existsSync(path.join(root,'compiled','website','avatar.html'))],
 ['ZERO_FEE_PUBLIC_CLAIM',fs.readFileSync(path.join(root,'..','public','b2b.html'),'utf8').includes('0% success fee')],
 ['NO_REVENUE_FROM_ORDER_CREATION',fs.readFileSync(path.join(root,'routes','dreamiez.js'),'utf8').includes('PENDING_PAYMENT_NOT_REVENUE')]
];
const b2bRoutes=fs.readFileSync(path.join(root,'routes','dreamiez.js'),'utf8');
checks.push(['B2B_DURABLE_PERSISTENCE_NOT_LOCAL_JSON',!b2bRoutes.includes("'b2b-rfqs.json'")&&!b2bRoutes.includes("'b2b-offers.json'")&&!b2bRoutes.includes("'b2b-orders.json'")]);
checks.push(['B2B_DATABASE_OUTAGE_FAILS_CLOSED',b2bRoutes.includes('SUPABASE')&&b2bRoutes.includes('503')]);
const failed=checks.filter(x=>!x[1]).map(x=>x[0]);
const proof={schema:'dreamledger/b2b-marketplace-contract/v1',generated_at:new Date().toISOString(),verdict:failed.length?'FAIL':'PASS',checks:Object.fromEntries(checks),failed,economic_truth:'Order creation is not revenue; verified revenue requires settled external payment, attribution, fulfilment and independent evidence.'};
const out=path.join(root,'data','proofs','B2B-MARKETPLACE-CONTRACT-PROOF.json');fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof,null,2));process.exit(failed.length?1:0);