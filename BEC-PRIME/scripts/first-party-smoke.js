'use strict';
const https=require('https');
const base=process.env.DREAMLEDGER_BASE_URL||'https://dreamledger.org';
function get(path){return new Promise((resolve,reject)=>{const r=https.get(base+path,res=>{let s='';res.on('data',c=>s+=c);res.on('end',()=>resolve({status:res.statusCode,body:s,headers:res.headers}));});r.on('error',reject);r.setTimeout(15000,()=>r.destroy(new Error('timeout')));});}
(async()=>{
 const paths=['/','/mtg','/mtg-search','/mtg-list','/login.html','/register.html','/commander-guide','/agent-commerce','/api/account/me','/dreamiez/register.html','/dreamiez/dreamiez.html','/api/dreamiez/me'];
 const results=[];
 for(const p of paths){try{const r=await get(p);const ok=r.status>=200&&r.status<400&&r.body.length>0;results.push({path:p,status:r.status,ok,content_type:r.headers['content-type']||'',bytes:r.body.length});}catch(e){results.push({path:p,status:0,ok:false,error:e.message});}}
 const api=await get('/api/products');
 let apiContract={path:'/api/products',status:api.status,ok:false};
 if(api.status>=200&&api.status<400){
   try{
     const data=JSON.parse(api.body);
     const records=Array.isArray(data.products)?data.products:(Array.isArray(data.offers)?data.offers:[]);
     const commander=records.find(x=>(x.id||x.product_id)==='COMMANDER-DECK-DIAGNOSTIC-001');
     apiContract={...apiContract,ok:!!commander,records:records.length,commander_present:!!commander};
   }catch(e){apiContract={...apiContract,error:'invalid_json'};}
 }
 results.push(apiContract);
 const failed=results.filter(x=>!x.ok);
 const proof={schema:'dreamledger/first-party-smoke/v1',base,verdict:failed.length?'FAIL':'PASS',results,failed};
 console.log(JSON.stringify(proof,null,2));
 process.exit(failed.length?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
