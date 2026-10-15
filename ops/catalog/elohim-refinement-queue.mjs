#!/usr/bin/env node
'use strict';

// Emits bounded refinement jobs for Gauntlet-passed catalogue records.
// The worker may propose improvements; it must not alter the candidate in place.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import readline from 'node:readline';
import { pathToFileURL } from 'node:url';
import { canonical, verifyGauntlet } from './catalog-factory.mjs';

const DEFAULT_INPUTS=['ops/catalog/build/seeds.ndjson','ops/catalog/build/products.ndjson'];
const SHA_RE=/^[a-f0-9]{64}$/i;
async function eachLine(file,fn) {
  if(!fs.existsSync(file)) return;
  const rl=readline.createInterface({input:fs.createReadStream(file,{encoding:'utf8'}),crlfDelay:Infinity});
  let n=0;
  for await(const line of rl) {
    n++;
    if(!line.trim()) continue;
    let row; try {row=JSON.parse(line);} catch {continue;}
    await fn(row,n);
  }
}
function nextReviewIsDue(elohim,now) {
  if(!elohim?.last_reviewed_at) return true;
  if(!elohim.next_review_at) return true;
  const due=Date.parse(elohim.next_review_at);
  return !Number.isFinite(due)||due<=now;
}
export async function buildElohimQueue({inputs=DEFAULT_INPUTS,outfile='ops/catalog/build/elohim-queue.ndjson',now=new Date()}={}) {
  const jobs=[];
  let rejected=0;
  for(const input of inputs) {
    await eachLine(path.resolve(input),async(row,lineNumber)=>{
      const verification=verifyGauntlet(row);
      if(!verification.passed || row.factory?.candidate_sha256!==verification.candidate_sha256) {rejected++;return;}
      const elohim=row.elohim||{};
      if(!nextReviewIsDue(elohim,now)) return;
      const candidate=row.candidate;
      jobs.push({
        schema_version:'dreamledger/elohim-refinement-job/v1',
        job_id:'ELOHIM-'+crypto.createHash('sha256').update(candidate.sku+'|'+verification.candidate_sha256).digest('hex').slice(0,20).toUpperCase(),
        sku:candidate.sku,
        silo:candidate.silo,
        record_state:row.factory.state,
        candidate_sha256:verification.candidate_sha256,
        gauntlet_run_id:row.gauntlet.run_id,
        prior_iteration:Number(elohim.iteration||0),
        source_refs:[candidate.source.ref],
        demand_evidence_ref:candidate.demand.evidence_ref,
        created_at:now.toISOString(),
        policy:{
          mode:'PROPOSAL_ONLY',
          can_mutate_candidate:false,
          can_approve_commercial_review:false,
          can_enable_checkout:false,
          can_claim_revenue:false,
          require_new_gauntlet_after_candidate_change:true
        },
        review_questions:[
          'Can the buyer problem and deliverable be stated more precisely without adding unsupported claims?',
          'Is the current source and demand evidence still current and directly relevant?',
          'What contradictions, missing constraints, rights questions, or fulfillment risks remain?',
          'What single low-cost refinement would most improve verified buyer value?',
          'Would any suggested change alter the canonical candidate or invalidate its Gauntlet digest?'
        ],
        response_contract:{
          required_fields:['proposal_id','base_candidate_sha256','recommendations','evidence_refs','risk_changes','requires_regauntlet','status'],
          allowed_statuses:['NO_CHANGE','PROPOSAL_READY','BLOCKED'],
          rule:'The response is a proposal, not an approved mutation. Candidate changes require new Gauntlet evidence.'
        },
        source:{file:path.resolve(input),line_number:lineNumber}
      });
    });
  }
  const out=path.resolve(outfile);
  fs.mkdirSync(path.dirname(out),{recursive:true});
  const body=jobs.map(x=>JSON.stringify(x)).join('\n')+(jobs.length?'\n':'');
  fs.writeFileSync(out,body);
  const proof={
    schema_version:'dreamledger/elohim-refinement-queue-proof/v1',
    generated_at:now.toISOString(),
    input_files:inputs.map(x=>path.resolve(x)),
    queued_count:jobs.length,
    rejected_unverified_or_stale_count:rejected,
    output_file:out,
    output_sha256:crypto.createHash('sha256').update(body).digest('hex'),
    policy:'Elohim proposes iteratively; it cannot self-approve or mutate the candidate without a new Gauntlet run.'
  };
  fs.writeFileSync(out+'.manifest.json',JSON.stringify(proof,null,2)+'\n');
  return proof;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) {
  const args=process.argv.slice(2);
  const inputIndex=args.indexOf('--inputs');
  const inputs=inputIndex>=0&&args[inputIndex+1]?args[inputIndex+1].split(','):DEFAULT_INPUTS;
  const outIndex=args.indexOf('--out');
  const outfile=outIndex>=0&&args[outIndex+1]?args[outIndex+1]:'ops/catalog/build/elohim-queue.ndjson';
  buildElohimQueue({inputs,outfile})
    .then(result=>console.log(JSON.stringify({status:'PASS',...result},null,2)))
    .catch(error=>{console.error(JSON.stringify({status:'HOLD',error:String(error.message||error)},null,2));process.exitCode=1;});
}
