'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {compile}=require('./CompileEditorialDrafts');
const load=n=>JSON.parse(fs.readFileSync(path.join(__dirname,'examples',n+'.json'),'utf8'));
const samples=['happy-homarid-shop','agent-bridge-b2b','dooh-rights-pilot','dreammeez-media-pilot'];
test('four silos compile separate provenance-labelled drafts',()=>{
 const ids=new Set();for(const n of samples){const r=compile(load(n));ids.add(r.manifest.id);
 assert.equal(r.manifest.status,'DRAFT_ONLY');assert.equal(r.manifest.published,false);
 assert.equal(r.manifest.verified_revenue_nzd,0);assert.equal(r.manifest.publication_approval_required,true);}
 assert.equal(ids.size,4);
});
test('repeat runs are hash-stable',()=>assert.deepEqual(compile(load('agent-bridge-b2b')),compile(load('agent-bridge-b2b'))));
test('patreon offer cannot carry Stripe link',()=>{const b=load('happy-homarid-shop');b.body+=' https://buy.stripe.com/test';assert.throws(()=>compile(b),/EXTERNAL_PATREON_CHECKOUT/);});
test('rights and citations fail closed',()=>{const b=load('dooh-rights-pilot');b.rights='unknown';assert.throws(()=>compile(b),/RIGHTS/);b.rights='owned';b.evidence_refs=[];assert.throws(()=>compile(b),/EVIDENCE/);});
test('member-only text does not leak to public previews',()=>{const b=load('happy-homarid-shop');b.members_only='UNIQUE_PRIVATE_PAYWALL_TEXT_867';
const f=compile(b).files;assert.ok(f['patreon-members-PRIVATE-DRAFT.md'].includes(b.members_only));
for(const k of ['patreon-free-DRAFT.md','discord-pointer-DRAFT.md','owned-web-preview-DRAFT.md'])assert.ok(!f[k].includes(b.members_only));});
test('source cannot grant its own publishing approval',()=>{const b=load('dreammeez-media-pilot');b.approved_for_publication=true;assert.throws(()=>compile(b),/SELF_APPROVAL/);});
