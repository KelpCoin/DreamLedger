#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';
import { notDispatchedEvidence, validateSubmissionContract } from './dispatch-contract.mjs';

const SUPABASE_URL = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const BRIDGE_TOKEN = String(process.env.EXTERNAL_ACTUATOR_TOKEN || '');
const ACTUATOR_ID = process.env.ACTUATOR_ID || 'generic_external_action';
const WORKER_ID = process.env.WORKER_ID || ('external-actuator-' + os.hostname() + '-' + process.pid);
const MAX_JOBS = Math.max(1, Math.min(Number(process.env.MAX_JOBS || 1), 5));
const HEADLESS = process.env.BROWSER_HEADLESS !== 'false';
const stateB64 = String(process.env.EXTERNAL_ACTUATOR_STORAGE_STATE_B64 || '');

if (!SUPABASE_URL || !BRIDGE_TOKEN || !stateB64) {
  console.error('EXTERNAL_ACTUATOR_NOT_ENROLLED');
  process.exit(2);
}

const bridge = async (op, args = {}) => {
  const r = await fetch(SUPABASE_URL + '/functions/v1/economic-actuator-bridge', {
    method: 'POST',
    headers: {'content-type':'application/json','x-dreamledger-agent-token':BRIDGE_TOKEN},
    body: JSON.stringify({op,args})
  });
  const body = await r.text();
  let data;
  try { data=JSON.parse(body || 'null'); } catch { data={raw:body}; }
  if (!r.ok) throw new Error(op + ' HTTP ' + r.status + ': ' + JSON.stringify(data).slice(0,1000));
  return data;
};

const required=(value,name)=>{
  if(!value) throw new Error('MISSING_' + name);
  return String(value);
};

async function executeJob(job,page){
  const p=job.payload||{};
  const a=p.exact_action||{};
  const spec=a.browser_action||p.browser_action||{};
  const url=required(spec.url||a.target_url,'BROWSER_URL');
  const submissionContract = validateSubmissionContract(spec);
  const submit = submissionContract.submit;
  const submitSelector = spec.submit_selector;
  const proposalText = spec.proposal_text || spec.body || '';

  await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});

  if(spec.must_contain_text){
    const body=await page.locator('body').innerText({timeout:10000});
    if(!body.includes(String(spec.must_contain_text))) throw new Error('AUTHENTICATED_TARGET_NOT_OBSERVED');
  }

  if(spec.fields&&typeof spec.fields==='object'){
    for(const [selector,value] of Object.entries(spec.fields)) await page.locator(selector).fill(String(value));
  }else if(proposalText){
    await page.locator(spec.proposal_selector||'textarea').first().fill(String(proposalText));
  }

  if (!submit) {
    return notDispatchedEvidence({
      url: page.url(),
      title: await page.title().catch(() => '')
    });
  }

  if (spec.before_submit_selector) await page.locator(spec.before_submit_selector).click();

  await page.locator(submitSelector).click({timeout:15000});
  await page.waitForTimeout(Number(spec.post_submit_wait_ms || 1500));

  let confirmation;
  if (spec.success_selector) {
    await page.locator(spec.success_selector).waitFor({state: 'visible', timeout: 15000});
    confirmation = {type: 'selector_visible', selector: String(spec.success_selector)};
  } else if (spec.success_text) {
    const body = await page.locator('body').innerText({timeout: 10000});
    if (!body.includes(String(spec.success_text))) throw new Error('SUBMISSION_CONFIRMATION_NOT_OBSERVED');
    confirmation = {type: 'success_text_observed'};
  } else {
    // Defensive duplicate check: never call a submit successful without a post-submit witness.
    throw new Error('MISSING_SUBMISSION_CONFIRMATION_CONTRACT');
  }

  return {
    dispatch_state: 'EXTERNAL_SENT',
    evidence: {
      url: page.url(),
      title: await page.title().catch(() => ''),
      submitted: true,
      confirmation
    }
  };
}

const tmp=path.join(os.tmpdir(),'dreamledger-external-actuator-' + process.pid + '.json');
fs.writeFileSync(tmp,Buffer.from(stateB64,'base64'),{mode:0o600});
const browser=await chromium.launch({headless:HEADLESS});
const context=await browser.newContext({storageState:tmp});
const page=await context.newPage();

try{
  await bridge('heartbeat',{p_actuator_id:ACTUATOR_ID,p_status:'AVAILABLE',
    p_evidence_reference:'worker:' + WORKER_ID,
    p_metadata:{protocol:'BEC-EXTERNAL-ACTUATOR-1.0',worker_id:WORKER_ID}});
  await bridge('reconcile_external_frontier',{p_limit:10});

  for(let i=0;i<MAX_JOBS;i++){
    const job=await bridge('claim_external_action_job',{p_worker_id:WORKER_ID,p_lease_seconds:300});
    if(!job) break;
    const row=Array.isArray(job)?job[0]:job;
    if(!row?.id||!row?.lease_token) break;
    try{
      const result=await executeJob(row,page);
      await bridge('record_external_action_result',{p_job_id:row.id,p_lease_token:row.lease_token,
        p_dispatch_state:result.dispatch_state,p_evidence:result.evidence});
      await bridge('complete_job',{p_job_id:row.id,p_lease_token:row.lease_token});
    }catch(error){
      const message=String(error?.message||error).slice(0,2000);
      try{await bridge('fail_job',{p_job_id:row.id,p_lease_token:row.lease_token,p_error:message});}catch{}
      console.error(JSON.stringify({job_id:row.id,status:'FAILED',error:message}));
    }
  }

  await bridge('heartbeat',{p_actuator_id:ACTUATOR_ID,p_status:'AVAILABLE',
    p_evidence_reference:'worker:' + WORKER_ID + ':completed',
    p_metadata:{protocol:'BEC-EXTERNAL-ACTUATOR-1.0',worker_id:WORKER_ID}});
}finally{
  await context.close();
  await browser.close();
  try{fs.rmSync(tmp,{force:true});}catch{}
}
