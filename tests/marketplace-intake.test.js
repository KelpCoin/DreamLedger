'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {Readable}=require('node:stream');

function request(body,method='POST'){
  const req=Readable.from([Buffer.from(JSON.stringify(body))]);
  req.method=method;req.headers={'content-type':'application/json'};return req;
}
function response(){return {headers:{},statusCode:200,setHeader(k,v){this.headers[k]=v},end(v){this.body=v;this.writableEnded=true}}}

test('RFQ adapter forwards body to configured Neon Worker',async t=>{
  process.env.MARKETPLACE_WORKER_URL='https://marketplace-preview.example.workers.dev';
  const path=require.resolve('../BEC-PRIME/routes/publicRfqIntake');
  delete require.cache[path];const adapter=require('../BEC-PRIME/routes/publicRfqIntake');
  const old=global.fetch;let call;
  global.fetch=async(url,opts)=>{call={url,opts};return {status:201,text:async()=>JSON.stringify({ok:true,reference:'rfq-1'})}};
  t.after(()=>{global.fetch=old;delete require.cache[path]});
  const res=response();const handled=await adapter.handle(request({title:'test'}),res,'/api/marketplace/intake');
  assert.equal(handled,true);assert.equal(res.statusCode,201);assert.match(call.url,/\/api\/marketplace\/intake$/);
  assert.deepEqual(JSON.parse(call.opts.body),{title:'test'});
});

test('RFQ adapter does not pretend persistence exists when Worker is unconfigured',async t=>{
  process.env.MARKETPLACE_WORKER_URL='';
  const path=require.resolve('../BEC-PRIME/routes/publicRfqIntake');
  delete require.cache[path];const adapter=require('../BEC-PRIME/routes/publicRfqIntake');
  t.after(()=>delete require.cache[path]);
  const res=response();await adapter.handle(request({title:'test'}),res,'/api/marketplace/intake');
  assert.equal(res.statusCode,503);assert.equal(JSON.parse(res.body).error,'MARKETPLACE_WORKER_NOT_CONFIGURED');
});

test('RFQ adapter ignores unrelated paths',async()=>{
  const adapter=require('../BEC-PRIME/routes/publicRfqIntake');
  assert.equal(await adapter.handle(request({}),response(),'/api/other'),false);
});
