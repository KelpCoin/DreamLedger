'use strict';
const https=require('https');
const base=process.env.DREAMLEDGER_BASE_URL||'https://dreamledger.org';
function get(path){return new Promise((resolve,reject)=>{const r=https.get(base+path,res=>{let s='';res.on('data',c=>s+=c);res.on('end',()=>resolve({status:res.statusCode,body:s,headers:res.headers}));});r.on('error',reject);r.setTimeout(15000,()=>r.destroy(new Error('timeout')));});}
(async()=>{
 const paths=['/','/login.html','/register.html','/dreamiez/register.html','/dreamiez/dreamiez.html','/api/dreamiez/me'];
 const results=[];
 for(const p of paths){try{const r=await get(p);results.push({path:p,status:r.status,ok:r.status>=200&&r.status<400,content_type:r.headers['content-type']||''});}catch(e){results.push({path:p,status:0,ok:false,error:e.message});}}
 const failed=results.filter(x=>!x.ok);
 const proof={schema:'dreamledger/first-party-smoke/v1',base,verdict:failed.length?'FAIL':'PASS',results,failed};
 console.log(JSON.stringify(proof,null,2));
 process.exit(failed.length?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
