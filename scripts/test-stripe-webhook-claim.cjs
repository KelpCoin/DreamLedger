'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const moduleUrl=pathToFileURL(path.join(__dirname,'..','supabase','functions','stripe-revenue-41104f355d6878cdd6d1f9dc','webhook-claim.mjs')).href;

class FakeDB {
  constructor(){this.events=new Map();this.insertCalls=0;this.lookupCalls=0;this.injectError=null;}
  from(name){
    assert.equal(name,'stripe_webhook_events');
    return {
      insert:async record=>{
        this.insertCalls++;
        if(this.injectError)return {error:{code:this.injectError}};
        if(this.events.has(record.event_id))return {error:{code:'23505'}};
        this.events.set(record.event_id,{...record});return {error:null};
      },
      select:fields=>({
        eq:(key,value)=>{
          assert.equal(key,'event_id');
          return {maybeSingle:async()=>{
            this.lookupCalls++;
            const row=this.events.get(value);
            return {data:row?{event_id:row.event_id,processed:row.processed}:null,error:null};
          }};
        }
      })
    };
  }
}
const event={id:'evt_1ABC2026',type:'checkout.session.completed',data:{object:{id:'cs_test_abc'}}};
test('first event uniquely claims inbox and never creates an order',async()=>{
 const {claimWebhookEvent}=await import(moduleUrl);const db=new FakeDB();
 assert.deepEqual(await claimWebhookEvent(db,event),{kind:'claimed'});
 assert.equal(db.events.size,1);assert.equal(db.events.get(event.id).processed,false);
});
test('simultaneous same-event deliveries: precisely one claim',async()=>{
 const {claimWebhookEvent}=await import(moduleUrl);const db=new FakeDB();
 const outcomes=await Promise.all(Array.from({length:12},()=>claimWebhookEvent(db,event)));
 assert.equal(outcomes.filter(o=>o.kind==='claimed').length,1);
 assert.equal(outcomes.filter(o=>o.kind==='pending').length,11);
 assert.equal(db.events.size,1);
});
test('processed event always deduplicates',async()=>{
 const {claimWebhookEvent}=await import(moduleUrl);const db=new FakeDB();
 assert.equal((await claimWebhookEvent(db,event)).kind,'claimed');
 db.events.get(event.id).processed=true;
 assert.equal((await claimWebhookEvent(db,event)).kind,'duplicate');
});
test('incomplete event is not acknowledged as processed',async()=>{
 const {claimWebhookEvent}=await import(moduleUrl);const db=new FakeDB();
 await claimWebhookEvent(db,event);
 assert.equal((await claimWebhookEvent(db,event)).kind,'pending');
});
test('unexpected storage error is not suppressed',async()=>{
 const {claimWebhookEvent}=await import(moduleUrl);const db=new FakeDB();db.injectError='42P01';
 assert.equal((await claimWebhookEvent(db,event)).kind,'storage_error');
});
test('invalid signature-untrusted input cannot reach storage claim',async()=>{
 const {claimWebhookEvent}=await import(moduleUrl);const db=new FakeDB();
 assert.equal((await claimWebhookEvent(db,{id:'other',type:'checkout.session.completed'})).kind,'invalid');
 assert.equal((await claimWebhookEvent(db,{})).kind,'invalid');
 assert.equal(db.insertCalls,0);
});
test('source contract: no check-then-upsert and code consumes claim decision',async()=>{
 const fs=require('node:fs');
 const source=fs.readFileSync(path.join(__dirname,'..','supabase','functions','stripe-revenue-41104f355d6878cdd6d1f9dc','index.ts'),'utf8');
 assert.match(source,/claimWebhookEvent\(supabase,event\)/);
 assert.match(source,/claim.kind==="pending"/);
 assert.doesNotMatch(source,/stripe_webhook_events"\)\.upsert\(\{event_id:eventId/);
 assert.match(source,/constructEventAsync\(/);
});
