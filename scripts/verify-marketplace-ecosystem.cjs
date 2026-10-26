'use strict';
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const pagePath=path.join(root,'public','marketplace-ecosystem.html');
const server=fs.readFileSync(path.join(root,'public','server.js'),'utf8');
const vercel=JSON.parse(fs.readFileSync(path.join(root,'vercel.json'),'utf8'));
const page=fs.readFileSync(pagePath,'utf8');
const checks=[
 ['page_has_responsive_viewport',/<meta name="viewport"/i.test(page)],
 ['page_has_real_listing_api',/fetch\('\/api\/marketplace\/listings'/i.test(page)],
 ['page_has_real_public_rfq_api',/fetch\('\/api\/marketplace\/rfqs'/i.test(page)],
 ['buyer_form_targets_existing_intake',/\/api\/marketplace\/intake/.test(page)],
 ['seller_form_targets_existing_seller_intake',/\/api\/marketplace\/seller-intake/.test(page)],
 ['buyer_contact_consent_required',/name="contact_consent" required/.test(page)],
 ['seller_rights_and_consent_required',/confirm I have the rights/.test(page)],
 ['no_sample_inventory_claims',/No inventory is invented/.test(page)],
 ['no_sample_demand_claims',/No sample demand is displayed/.test(page)],
 ['explicit_non_live_checkout_boundary',/checkout, escrow, buyer\/seller messaging, auctions, shipping, reputation and public creator feeds are not represented as live/.test(page)],
 ['render_route_registered',server.includes("'/explore':'marketplace-ecosystem.html'")],
 ['vercel_route_registered',vercel.rewrites.some(r=>r.source==='/explore'&&r.destination==='/marketplace-ecosystem.html')],
 ['homepage_discovery_link',fs.readFileSync(path.join(root,'public','home.html'),'utf8').includes('href="/explore"')]
];
const inline=[...page.matchAll(/<script>([\s\S]*?)<\/script>/gi)];
if(!inline.length)checks.push(['inline_script_present',false]);
else {try{for(const m of inline)new vm.Script(m[1],{filename:'marketplace-ecosystem.inline.js'});checks.push(['inline_script_syntax',true])}catch(e){checks.push(['inline_script_syntax',false]);console.error(e.message)}}
const failed=checks.filter(x=>!x[1]).map(x=>x[0]);
const result={schema:'dreamledger/marketplace-ecosystem-proof/v1',verdict:failed.length?'FAIL':'PASS',checks:Object.fromEntries(checks),failed,scope:'Static contract only; does not prove deployment, database configuration, listing availability, or revenue.'};
console.log(JSON.stringify(result,null,2));
if(failed.length)process.exit(1);
