'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {diagnose,repairSources}=require('./marketplace-self-build.cjs');
const root=path.resolve(__dirname,'../..');
test('known production-regression signatures are detected, not waived',()=>{
 const e=fs.readFileSync(path.join(root,'BEC-PRIME/auction-engine.js'),'utf8');
 const p=fs.readFileSync(path.join(root,'public/auctions.html'),'utf8');
 const warnings=diagnose(e,p);
 assert(Array.isArray(warnings));
 assert(warnings.length>=1 || e.includes('AUTHENTICATED_NEON_BID_EXECUTOR_REQUIRED'));
});
test('bounded repair generator removes unsafe execution on real source snapshot',()=>{
 const e=fs.readFileSync(path.join(root,'BEC-PRIME/auction-engine.js'),'utf8');
 const p=fs.readFileSync(path.join(root,'public/auctions.html'),'utf8');
 const repaired=repairSources(e,p);
 if(diagnose(e,p).length){
   assert.deepEqual(diagnose(repaired.engine,repaired.page),[]);
   assert(!repaired.engine.includes('a.ends_at = t +'));
   assert(repaired.engine.includes('AUTHENTICATED_NEON_BID_EXECUTOR_REQUIRED'));
   assert(repaired.page.includes('disabled>Bidding unavailable pending verified checkout'));
 }
});
test('generated HTML script must parse without executing network or action',()=>{
 const e=fs.readFileSync(path.join(root,'BEC-PRIME/auction-engine.js'),'utf8');
 const p=fs.readFileSync(path.join(root,'public/auctions.html'),'utf8');
 const repaired=repairSources(e,p);
 const scripts=[...repaired.page.matchAll(/<script>([\s\S]*?)<\/script>/g)];
 assert(scripts.length>0);
 for(const match of scripts)assert.doesNotThrow(()=>new vm.Script(match[1]));
});
test('detector holds absent seller approval, human identity and live bid trust',()=>{
 const warnings=diagnose("function placeBid(){return 1}","<script>localStorage.x=1</script>");
 assert(warnings.includes('UNVERIFIED_BID_EXECUTOR'));
 assert(warnings.includes('SELLER_GAUNTLET_UNBOUND'));
 assert(warnings.includes('SYNTHETIC_BROWSER_AUCTION'));
});
test('bounded generator contains no payment/public action endpoints',()=>{
 const src=fs.readFileSync(__dirname+'/marketplace-self-build.cjs','utf8');
 assert(!/sk_live_|stripe\.com\/v1|api\.metricool|SUPABASE_SERVICE_ROLE_KEY/.test(src));
});
