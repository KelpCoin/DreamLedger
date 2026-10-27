'use strict';
// BECK search and agent discovery integrity guard, dependency-free and read-only.
// npm/node: node scripts/verify-search-and-agent-discovery.cjs [--live]
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),pub=path.join(root,'public');
const text=(rel)=>fs.readFileSync(path.join(pub,rel),'utf8');
const json=(rel)=>JSON.parse(text(rel));
const site='https://dreamledger.org';
const offers=[
 {id:'EDH_0001',product_url:site+'/mtg/edh-0001.html',price_nzd:400,checkout_url:'https://buy.stripe.com/14A3cvea1dSd1DV5oEdwc1J'},
 {id:'DREAMLEDGER-BILLBOARD-FOUNDING-001',product_url:site+'/billboard.html',price_nzd:50,checkout_url:'https://buy.stripe.com/00w4gz6HzeWhcizeZedwc2w'},
 {id:'QUOTE-COMPARE-49',product_url:site+'/quote-compare-49.html',price_nzd:49,checkout_url:'https://buy.stripe.com/00wdR93vnbK5eqH3gwdwc3r'}
];
const sitemap=text('sitemap.xml'),robots=text('robots.txt'),llms=text('llms.txt');
assert.match(sitemap,/<urlset\b/);assert.match(sitemap,/<\/urlset>/);
assert.match(robots,/Sitemap: https:\/\/dreamledger\.org\/sitemap\.xml/);
for(const suffix of ['/go/','/mtg/edh-0001.html','/agent-mandates/']){
 assert.ok(sitemap.includes('<loc>'+site+suffix+'</loc>'),'sitemap missing '+suffix);
 assert.ok(fs.statSync(path.join(pub,suffix==='/'?'index.html':suffix.endsWith('/')?suffix.slice(1)+'index.html':suffix.slice(1))).isFile());
}
for(const suffix of ['/go/','/agent-mandates/'])assert.ok(llms.includes(site+suffix),'llms missing '+suffix);
const feeds=[
 json('agent-commerce.json').primary_offers,
 json('.well-known/agent-commerce.json').primary_offers,
 json('.well-known/dreamledger.json').commerce.primary_paid_offers,
 json('ai-catalog.json').current_offers,
 json('.well-known/ai-catalog.json').current_offers
];
for(const feed of feeds) {
 assert.ok(Array.isArray(feed),'missing feed offers');
 for(const o of offers){
  const item=feed.find(x=>(x.product_id||x.id)===o.id);
  assert.ok(item,'missing commercial SKU '+o.id);
  assert.equal(item.price_nzd,o.price_nzd,'price mismatch '+o.id);
  assert.equal(item.product_url,o.product_url,'product URL mismatch '+o.id);
  if(item.checkout_url)assert.equal(item.checkout_url,o.checkout_url,'checkout mismatch '+o.id);
 }
 assert.ok(!feed.some(x=>(x.product_id||x.id)==='COMMANDER-DECK-DIAGNOSTIC-001'),'held service falsely in live offers');
}
const products=json('agent-products.json');
const held=products.find(x=>x.sku==='COMMANDER-DECK-DIAGNOSTIC-001');
assert.ok(held && held.enable_checkout===false,'held diagnostic enabled');
for(const o of offers){
 const p=products.find(x=>x.sku===o.id);
 assert.ok(p && p.enable_checkout===true,'live product not in agent feed: '+o.id);
 assert.equal(p.url,o.product_url,'agent product URL mismatch');
}
const edhDoc=text('mtg/edh-0001.html');
assert.ok(edhDoc.includes('application/ld+json')&&edhDoc.includes('priceCurrency')&&edhDoc.includes('NZD'));
assert.ok(edhDoc.includes(offers[0].checkout_url));
assert.ok(text('agent-mandates/index.html').includes('research and prototype design'));
assert.ok(!text('agent-mandates/index.html').includes('Our customers include'));
for(const [rel,canonical] of [['mtg/edh-0001.html',offers[0].product_url],['agent-mandates/index.html',site+'/agent-mandates/'],['go/index.html',site+'/go/']]){
 assert.ok(text(rel).includes('<link rel="canonical" href="'+canonical+'">'),'canonical missing '+rel);
}
console.log('DISCOVERY_STATIC_PASS: 3 current offers, 5 consistent feeds, sitemap, llms, 3 canonical pages; zero sale claims');
if(process.argv.includes('--live')){
 (async()=>{
  const checks=['/robots.txt','/sitemap.xml','/llms.txt','/agent-mandates/','/mtg/edh-0001.html','/go/','/agent-commerce.json','/agent-products.json'];
  for(const u of checks){
   const res=await fetch(site+u,{headers:{'user-agent':'BECK-discoverability-readonly/1.0'},signal:AbortSignal.timeout(15000)});
   assert.equal(res.status,200,'public route unhealthy '+u);
   const data=await res.text();assert.ok(data.length>60,'public response unexpectedly empty '+u);
   if(u==='/mtg/edh-0001.html')assert.ok(data.includes(offers[0].checkout_url),'public EDH checkout missing');
   if(u==='/agent-commerce.json')assert.ok(data.includes('LISTED_CHECKOUT_ACTIVE'),'agent offers stale');
   console.log('DISCOVERY_LIVE_PASS '+u+' '+res.status);
  }
 })().catch(e=>{console.error('DISCOVERY_LIVE_FAIL',e.message);process.exitCode=1});
}
