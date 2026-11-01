'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {stripTypeScriptTypes}=require('node:module');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
function load(rel,env={}){
  let source=readFileSync(path.join(root,rel),'utf8');
  source=stripTypeScriptTypes(source,{mode:'strip'}).replace(
    /export default async function handler\(/,'globalThis.__handler = async function handler(');
  if(!source.includes('globalThis.__handler'))throw Error('handler_missing');
  const context={Request,Response,URL,Buffer,process:{env},console:{log(){},error(){}},
    AbortSignal,globalThis:null};
  context.globalThis=context;
  vm.runInNewContext(source,context,{filename:rel});
  assert.equal(typeof context.__handler,'function');
  return context.__handler;
}
function request(route,options){return new Request('https://dreamledger.org/'+route,options)}
test('inventory Vercel function rejects non-GET',async()=>{
  const h=load('api/molt-beach-inventory.ts');
  const r=await h(request('api/molt-beach-inventory',{method:'POST'}));
  assert.equal(r.status,405);
});
test('inventory Vercel function returns 503 for unverified markets',async()=>{
  const h=load('api/molt-beach-inventory.ts');
  const r=await h(request('api/molt-beach-inventory?market=GLOBAL'));
  assert.equal(r.status,503);
});
test('checkout Vercel function rejects cross-origin requests',async()=>{
  const h=load('api/molt-beach-checkout.ts');
  const r=await h(request('api/molt-beach-checkout',{method:'POST',headers:{origin:'https://evil.invalid','content-type':'application/json'},body:'{}'}));
  assert.equal(r.status,403);
});
test('checkout Vercel function is disabled by default without touching network',async()=>{
  const h=load('api/molt-beach-checkout.ts');
  const r=await h(request('api/molt-beach-checkout',{method:'POST',
    headers:{origin:'https://dreamledger.org','content-type':'application/json'},body:'{}'}));
  assert.equal(r.status,503);
  assert.equal((await r.json()).error,'checkout_not_activated');
});
test('webhook Vercel function is disabled by default',async()=>{
  const h=load('api/webhooks/beck-ad-stripe.ts');
  const r=await h(request('api/webhooks/beck-ad-stripe',{method:'POST',body:'{}'}));
  assert.equal(r.status,503);
});
test('webhook rejects unsigned request even if flags are on',async()=>{
  const h=load('api/webhooks/beck-ad-stripe.ts',{
    BECK_AD_WEBHOOK_ENABLED:'true',BECK_AD_OWNER_RELEASE_APPROVED:'true'
  });
  const r=await h(request('api/webhooks/beck-ad-stripe',{method:'POST',body:'{}'}));
  assert.equal(r.status,400);
});
test('existing Vercel deployment configuration stays approval-gated',()=>{
  const cfg=JSON.parse(readFileSync(path.join(root,'vercel.json'),'utf8'));
  assert.equal(cfg.git?.deploymentEnabled,false);
  assert.equal(cfg.outputDirectory,'public');
  assert.ok(cfg.functions?.['api/**/*.ts']);
  for(const route of ['api/molt-beach-inventory.ts','api/molt-beach-checkout.ts','api/webhooks/beck-ad-stripe.ts'])
    assert.ok(readFileSync(path.join(root,route),'utf8').includes('export default async function handler'));
});
