'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const agent=fs.readFileSync(path.join(root,'AGENTS.md'),'utf8');
const docs=fs.readFileSync(path.join(root,'docs/BECK-AD-COMMERCE-CANDIDATE.md'),'utf8');
const proof=JSON.parse(fs.readFileSync(path.join(root,'proof/beck-ads/2026-11-01-provider-policy.json'),'utf8'));
test('the BECK agent contract explicitly retires Render',()=>{
 assert.match(agent,/Render is retired and not part of BECK.s operating stack/);
 assert.match(agent,/Never suggest restarting, using, monitoring, repairing, deploying to, paying for, or depending on Render/);
});
test('accessibility and no-PC execution stay mandatory',()=>{
 assert.match(agent,/must \*\*not\*\* be handed repetitive manual code edits/);
 assert.match(agent,/cloud-continued, no-PC workflows/);
 assert.match(agent,/DreamLedger is one exhaust/);
});
test('economic tracker and documented provider policy agree',()=>{
 assert.match(docs,/Infrastructure lock: Render retired/);
 assert.equal(proof.guardrails.retired_provider,'Render');
 assert.equal(proof.guardrails.no_reactivation,true);
 assert.equal(proof.guardrails.no_manual_chore_transfer_to_operators,true);
 assert.equal(proof.status,'DURABLE_RULE_STAGED');
});
