import assert from 'node:assert/strict';
import { test } from 'node:test';
import { handleRfqIntake } from './templates/rfq-inbox.worker.mjs';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const origin='https://preview.example.pages.dev';
const env={RFQ_INTAKE_ENABLED:'true',
  AIRTABLE_TOKEN:'pat_private_staging_test_token_xxxxxx',
  AIRTABLE_LEADS_BASE_ID:'app12345678901234',
  AIRTABLE_LEADS_TABLE_ID:'tbl12345678901234',
  TURNSTILE_SECRET:'test_secret_staging_xxxxxxxxxx',
  TURNSTILE_SITE_KEY:'test_site_key_public_xxxxx'};
const values={
  company:'Test Acme',email:'buyer@example.org',category:'Professional services',
  title:'Compare invoice totals',details:'Review three supplier quotes for mismatches.',
  budget:'unknown',region:'Auckland',service:'verification_review',
  turnstile_token:'accepted_on_fake'};
function req(fields=values,headers={}) {
  return new Request(origin+'/api/rfq',{method:'POST',
    headers:{origin,'content-type':'application/json',...headers},
    body:JSON.stringify(fields)});
}
test('site key never leaked without all owner-approved credentials',async()=>{
  const r=await handleRfqIntake(new Request(origin+'/api/inquiry-config'),{...env,RFQ_INTAKE_ENABLED:'false'});
  assert.equal((await r.json()).enabled,false);
});
test('private intake fails closed without configured backend',async()=>{
  const r=await handleRfqIntake(req(),{});
  assert.equal(r.status,503);
});
test('cross-origin request denied before verification or write',async()=>{
  let called=false;
  const r=await handleRfqIntake(req(values,{origin:'https://attacker.invalid'}),env,async()=>{called=true});
  assert.equal(r.status,403);assert.equal(called,false);
});
test('malformed and oversize data denied without writes',async()=>{
  let called=false;
  const fake=async()=>{called=true};
  for(const payload of [{...values,email:'not-an-email'},{...values,details:'x'.repeat(2000)},
    {...values,website:'honeypot'},{...values,service:'sell_unverified_payment'}]) {
    const r=await handleRfqIntake(req(payload),env,fake);
    assert.equal(r.status,400);
  }
  assert.equal(called,false);
});
test('failed Turnstile challenge blocks write',async()=>{
  const r=await handleRfqIntake(req(),env,async()=>new Response(JSON.stringify({success:false,hostname:new URL(origin).hostname}),{status:200}));
  assert.equal(r.status,403);
});
test('no 202 without durable Airtable confirmation',async()=>{
  let count=0;
  const fake=async(_url,opts)=>{count++;return count===1
    ? new Response(JSON.stringify({success:true,hostname:new URL(origin).hostname}),{status:200})
    : new Response(JSON.stringify({error:'quota'}),{status:429});};
  const r=await handleRfqIntake(req(),env,fake);
  assert.equal(r.status,503);
});
test('stored lead gets truthful receipt, no money or delivery claim',async()=>{
  let record;
  const fake=async(url,opts)=>{
    if(String(url).includes('siteverify'))return new Response(JSON.stringify({success:true,hostname:new URL(origin).hostname}),{status:200});
    record=JSON.parse(opts.body);
    assert.match(opts.headers.authorization,/^Bearer /);
    return new Response(JSON.stringify({id:'rec12345678901234'}),{status:200});
  };
  const r=await handleRfqIntake(req(),env,fake);
  assert.equal(r.status,202);
  const d=await r.json();
  assert.equal(d.status,'RECEIVED_UNVERIFIED');
  assert.equal(d.paid,false);
  assert.equal(d.gauntlet,'NOT_RUN');
  assert.equal(record.fields['Revenue Claimed NZD'],0);
  assert.equal(record.fields['Gauntlet State'],'NOT_RUN');
  assert.equal(record.fields['Contact Email'],values.email);
  assert.match(record.fields['Source Fingerprint SHA256'],/^[a-f0-9]{64}$/);
});

test('B2B inline JavaScript parses and never stores leads in browser',()=>{
  const s=readFileSync('public/b2b.html','utf8');
  const match=[...s.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].at(-1);
  assert.ok(match,'missing script');
  assert.doesNotThrow(()=>new vm.Script(match[1]));
  assert.ok(s.includes('id="website"'));
  assert.ok(s.includes('/api/inquiry-config'));
  assert.ok(s.includes('/api/rfq'));
  assert.ok(!s.includes('localStorage.setItem'));
  assert.ok(!s.includes('statusener'));
  assert.ok(!s.includes('https://buy.stripe.com/'));
  assert.ok(!s.includes('NZ$29 fixed'));
});
test('degraded Cloudflare preview disables even fully configured private intake',async()=>{
  const code=readFileSync('ops/migration/cloudflare-preview/_worker.js','utf8');
  const m=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
  const preview={...env,ASSETS:{fetch:async()=>new Response('not used')}};
  const status=await m.default.fetch(new Request(origin+'/api/inquiry-config'),preview);
  assert.equal(status.status,200);
  assert.equal((await status.json()).enabled,false);
  const post=await m.default.fetch(req(),preview);
  assert.equal(post.status,503);
  assert.equal((await post.json()).status,'BLOCKED_ROUTE_NOT_MIGRATED');
});
