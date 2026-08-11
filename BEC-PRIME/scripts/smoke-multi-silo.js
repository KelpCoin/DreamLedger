'use strict';
const http = require('http');
const { spawn } = require('child_process');

const PORT = 3310;
let child;
function request(pathname){return new Promise((resolve,reject)=>{const req=http.get(`http://127.0.0.1:${PORT}${pathname}`,res=>{let body='';res.setEncoding('utf8');res.on('data',c=>body+=c);res.on('end',()=>resolve({status:res.statusCode,body}));});req.on('error',reject);req.setTimeout(5000,()=>req.destroy(new Error('timeout')));});}
async function waitForHealth(){for(let i=0;i<30;i++){try{const r=await request('/healthz');if(r.status===200)return r;}catch{}await new Promise(r=>setTimeout(r,200));}throw new Error('server did not become healthy');}
async function main(){
 child=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:String(PORT),STRIPE_SECRET_KEY:'',STRIPE_WEBHOOK_SECRET:''},stdio:['ignore','pipe','pipe']});
 child.stdout.on('data',d=>process.stdout.write(d)); child.stderr.on('data',d=>process.stderr.write(d));
 try{
  const health=await waitForHealth();
  const checks=['/mtg','/dreamiez','/api/products','/api/offers'];
  const results={};
  for(const p of checks){const r=await request(p);if(r.status!==200)throw new Error(`${p} returned HTTP ${r.status}`);results[p]={status:r.status,bytes:r.body.length};}
  const h=JSON.parse(health.body);
  if(h.status!=='ok')throw new Error('health status is not ok');
  console.log(JSON.stringify({verdict:'PASS',health:h.status,checks:results},null,2));
 }finally{if(child)child.kill('SIGTERM');}
}
main().catch(err=>{console.error(JSON.stringify({verdict:'FAIL',error:err.message},null,2));if(child)child.kill('SIGKILL');process.exit(1);});
