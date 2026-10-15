#!/usr/bin/env node
'use strict';

// Live Stripe Payment Links are active as soon as created. This provisioner is
// dry-run by default and creates links only for fully gated PRODUCT_READY records.

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import crypto from 'node:crypto';
import { once } from 'node:events';
import { pathToFileURL } from 'node:url';
import { canonical, sha256, verifyGauntlet } from './catalog-factory.mjs';

const SHA256_RE = /^[a-f0-9]{64}$/i;
const DEFAULT_BATCH_LIMIT = 25;
const MAX_BATCH_LIMIT = 250;
const STRIPE_API = 'https://api.stripe.com/v1';

function readArgs(argv) {
  const out = { dryRun: true, limit: DEFAULT_BATCH_LIMIT, input: 'ops/catalog/build/products.ndjson', state: 'ops/catalog/build/stripe-link-state.ndjson' };
  for (let i=0;i<argv.length;i++) {
    const a=argv[i];
    if (a==='--apply-live') out.dryRun=false;
    else if (a==='--input' && argv[i+1]) out.input=argv[++i];
    else if (a==='--state' && argv[i+1]) out.state=argv[++i];
    else if (a==='--limit' && argv[i+1]) out.limit=Number(argv[++i]);
    else if (a==='--help') out.help=true;
    else throw new Error('Unknown or incomplete argument: '+a);
  }
  if (!Number.isSafeInteger(out.limit) || out.limit<1 || out.limit>MAX_BATCH_LIMIT) {
    throw new Error('Batch limit must be between 1 and '+MAX_BATCH_LIMIT);
  }
  return out;
}
async function eachLine(file, fn) {
  if (!fs.existsSync(file)) throw new Error('Input file not found: '+file);
  const rl=readline.createInterface({input:fs.createReadStream(file,{encoding:'utf8'}),crlfDelay:Infinity});
  let lineNumber=0;
  for await (const line of rl) {
    lineNumber++;
    if (!line.trim()) continue;
    let value;
    try { value=JSON.parse(line); } catch { throw new Error('Invalid JSON on line '+lineNumber); }
    await fn(value,lineNumber);
  }
}
async function writeLine(stream,value) {
  if (!stream.write(JSON.stringify(value)+'\n')) await once(stream,'drain');
}
function finish(stream) {
  return new Promise((resolve,reject)=>{stream.once('finish',resolve);stream.once('error',reject);stream.end();});
}
function productBlockers(record) {
  const c=record?.candidate||{};
  const g=verifyGauntlet(record);
  const blockers=[];
  if (record?.factory?.state!=='PRODUCT_READY') blockers.push('FACTORY_STATE_NOT_PRODUCT_READY');
  if (!g.passed) blockers.push(...g.failures);
  if (!c.sku || !c.silo || !c.name || !String(c.description||'').trim()) blockers.push('PRODUCT_IDENTITY_INCOMPLETE');
  if (!c.source?.ref || !SHA256_RE.test(String(c.source?.sha256||''))) blockers.push('SOURCE_PROVENANCE_INVALID');
  if (!c.price || !/^[a-z]{3}$/i.test(String(c.price.currency||'')) ||
      !Number.isSafeInteger(c.price.unit_amount_minor) || c.price.unit_amount_minor<=0) blockers.push('PRICE_INVALID');
  if (c.price?.billing_mode==='subscription' && !['day','week','month','year'].includes(c.price.interval)) blockers.push('SUBSCRIPTION_INTERVAL_INVALID');
  if (c.fulfillment?.status!=='PASS' || !c.fulfillment?.contract_id || !c.fulfillment?.test_ref ||
      !SHA256_RE.test(String(c.fulfillment?.test_sha256||''))) blockers.push('FULFILLMENT_NOT_VERIFIED');
  if (record?.commercial_review?.status!=='APPROVED' || !record.commercial_review?.approved_by) blockers.push('COMMERCIAL_REVIEW_NOT_APPROVED');
  if (record?.checkout?.live_activation_approved!==true || !record.checkout.approved_by || !record.checkout.approved_at) blockers.push('LIVE_CHECKOUT_APPROVAL_MISSING');
  if (record?.factory?.live_checkout_enabled_for_silo!==true) blockers.push('SILO_CHECKOUT_DISABLED');
  return [...new Set(blockers)];
}
function formEncode(entries) {
  const out=new URLSearchParams();
  for(const [k,v] of Object.entries(entries)) {
    if (v===undefined || v===null) continue;
    out.set(k,String(v));
  }
  return out.toString();
}
async function stripeCreateLink(record, secretKey) {
  const c=record.candidate;
  const digest=record.factory.candidate_sha256;
  const metadata={
    dreamledger_sku:c.sku,
    dreamledger_silo:c.silo,
    dreamledger_schema:'catalog-candidate-v1',
    dreamledger_gauntlet_run_id:String(record.gauntlet.run_id).slice(0,500),
    dreamledger_candidate_sha256:digest,
    dreamledger_fulfillment_contract:String(c.fulfillment.contract_id).slice(0,500)
  };
  const body={
    'line_items[0][quantity]':1,
    'line_items[0][price_data][currency]':String(c.price.currency).toLowerCase(),
    'line_items[0][price_data][unit_amount]':c.price.unit_amount_minor,
    'line_items[0][price_data][product_data][name]':c.name,
    'line_items[0][price_data][product_data][description]':String(c.description).slice(0,4000),
    'line_items[0][price_data][product_data][metadata][dreamledger_sku]':c.sku,
    'line_items[0][price_data][product_data][metadata][dreamledger_silo]':c.silo,
    'line_items[0][price_data][product_data][metadata][dreamledger_candidate_sha256]':digest,
    'metadata[dreamledger_sku]':c.sku,
    'metadata[dreamledger_silo]':c.silo,
    'metadata[dreamledger_schema]':'catalog-candidate-v1',
    'metadata[dreamledger_gauntlet_run_id]':String(record.gauntlet.run_id).slice(0,500),
    'metadata[dreamledger_candidate_sha256]':digest,
    'metadata[dreamledger_fulfillment_contract]':String(c.fulfillment.contract_id).slice(0,500),
    'after_completion[type]':'hosted_confirmation',
    'inactive_message':'This offer is not currently available. Please return to the DreamLedger catalogue.'
  };
  if ((c.price.billing_mode||'one_time')==='subscription') {
    body['line_items[0][price_data][recurring][interval]']=c.price.interval;
    if (c.price.interval_count) body['line_items[0][price_data][recurring][interval_count]']=c.price.interval_count;
  }
  const idem='dreamledger-link-'+c.sku.toLowerCase()+'-'+digest.slice(0,32);
  const response=await fetch(STRIPE_API+'/payment_links',{
    method:'POST',
    headers:{
      Authorization:'Bearer '+secretKey,
      'Content-Type':'application/x-www-form-urlencoded',
      'Idempotency-Key':idem
    },
    body:formEncode(body),
    redirect:'error'
  });
  const responseText=await response.text();
  let data;
  try { data=JSON.parse(responseText); } catch { data={message:responseText.slice(0,500)}; }
  if (!response.ok) {
    const error=new Error('STRIPE_API_'+response.status+':'+String(data?.error?.message||'request failed').slice(0,300));
    error.status=response.status;
    throw error;
  }
  if (!data.id || !data.url || data.active!==true) throw new Error('STRIPE_LINK_RESPONSE_NOT_ACTIVE_OR_INCOMPLETE');
  return { id:data.id,url:data.url,active:data.active,created:data.created,metadata:data.metadata||metadata,idempotency_key:idem };
}
async function runProvisioner(options) {
  const ack='I_UNDERSTAND_LIVE_STRIPE_LINKS_ARE_ACTIVE';
  if (!options.dryRun) {
    if (process.env.STRIPE_LIVE_ENABLED!=='true') throw new Error('STRIPE_LIVE_ENABLED must equal true');
    if (process.env.DREAMLEDGER_STRIPE_LIVE_ACK!==ack) throw new Error('DREAMLEDGER_STRIPE_LIVE_ACK must equal '+ack);
    if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_SECRET_KEY.startsWith('sk_live_')) throw new Error('A live STRIPE_SECRET_KEY is required; key value is never printed');
  }
  const input=path.resolve(options.input);
  const statePath=path.resolve(options.state);
  if (!fs.existsSync(input)) throw new Error('Input products file not found: '+input);
  const existing=new Map();
  if(fs.existsSync(statePath)) {
    await eachLine(statePath, async row=>{
      if(row?.sku && ['CREATED','SKIPPED'].includes(row.state)) existing.set(row.sku,row);
      else if(row?.sku && row.state==='REVIEW_REQUIRED') existing.set(row.sku,row);
    });
  }
  const selected=[];
  const skipped=[];
  await eachLine(input,async(record,line)=>{
    const sku=record?.candidate?.sku;
    if(!sku) { skipped.push({line,state:'SKIPPED',reason:'SKU_MISSING'}); return; }
    if(existing.has(sku)) { skipped.push({sku,line,state:'SKIPPED',reason:'STATE_ALREADY_EXISTS'}); return; }
    const blockers=productBlockers(record);
    if(blockers.length) { skipped.push({sku,line,state:'SKIPPED',reason:blockers}); return; }
    if(selected.length<options.limit) selected.push({record,line});
  });
  const outDir=path.dirname(statePath);
  fs.mkdirSync(outDir,{recursive:true});
  const stream=fs.createWriteStream(statePath,{flags:'a',encoding:'utf8'});
  const results=[];
  try {
    for(const item of selected) {
      const c=item.record.candidate;
      const attempt={sku:c.sku,silo:c.silo,candidate_sha256:item.record.factory.candidate_sha256,gauntlet_run_id:item.record.gauntlet.run_id,attempted_at:new Date().toISOString()};
      if(options.dryRun) {
        const row={...attempt,state:'DRY_RUN',would_create_active_link:true,price_minor:c.price.unit_amount_minor,currency:c.price.currency,billing_mode:c.price.billing_mode||'one_time'};
        results.push(row);
        continue;
      }
      const started={...attempt,state:'PROVISIONING_STARTED',idempotency_key:'dreamledger-link-'+c.sku.toLowerCase()+'-'+item.record.factory.candidate_sha256.slice(0,32)};
      await writeLine(stream,started);
      try {
        const link=await stripeCreateLink(item.record,process.env.STRIPE_SECRET_KEY);
        const success={...attempt,...link,state:'CREATED',created_at:new Date().toISOString(),mode:'LIVE'};
        await writeLine(stream,success);
        results.push(success);
      } catch(error) {
        const status=Number(error.status||0);
        const uncertain=status===0 || status===408 || status===409 || status===429 || status>=500;
        const failure={...attempt,state:uncertain?'REVIEW_REQUIRED':'FAILED',error:String(error.message||error).slice(0,500),retry_rule:uncertain?'Reconcile same deterministic idempotency key before retry; do not blindly create another link.':'Correct the source/gate error before retry.'};
        await writeLine(stream,failure);
        results.push(failure);
        if(uncertain) break;
        if(status===429) break;
      }
    }
  } finally { await finish(stream); }
  const result={
    schema_version:'dreamledger/stripe-link-provisioning-batch/v1',
    generated_at:new Date().toISOString(),
    mode:options.dryRun?'DRY_RUN':'LIVE',
    input,
    state_file:statePath,
    candidates_seen:selected.length+skipped.length,
    selected_count:selected.length,
    skipped_count:skipped.length,
    created_count:results.filter(x=>x.state==='CREATED').length,
    failed_count:results.filter(x=>['FAILED','REVIEW_REQUIRED'].includes(x.state)).length,
    created_links:results.filter(x=>x.state==='CREATED').map(x=>({sku:x.sku,silo:x.silo,id:x.id,url:x.url,active:x.active,created_at:x.created_at})),
    skipped:skipped.slice(0,100),
    results,
    guardrails:{
      live_links_are_active_immediately:true,
      gauntlet_digest_required:true,
      every_record_revalidated:true,
      default_mode:'DRY_RUN',
      per_run_limit_max:MAX_BATCH_LIMIT,
      live_ack_required:ack
    },
    business_truth:'NOT_CLAIMED'
  };
  return result;
}
if (process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) {
  const options=readArgs(process.argv.slice(2));
  if(options.help) {
    console.log('Usage: node ops/catalog/stripe-link-provisioner.mjs --input ops/catalog/build/products.ndjson --limit 25 [--apply-live]');
  } else {
    runProvisioner(options)
      .then(r=>console.log(JSON.stringify(r,null,2)))
      .catch(error=>{console.error(JSON.stringify({status:'HOLD',error:String(error.message||error)},null,2));process.exitCode=1;});
  }
}
export { productBlockers, stripeCreateLink, runProvisioner };
