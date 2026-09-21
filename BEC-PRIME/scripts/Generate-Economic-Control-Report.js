'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'control');
const REPORT = path.join(OUT, 'CONTROL-REPORT-LATEST.json');
const BLOCKERS = path.join(OUT, 'BLOCKER-REPORT-LATEST.json');
const PROOF = path.join(OUT, 'IMPLEMENTATION-PROOF-LATEST.json');

function cfg() {
  const url = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '');
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  return { url, key };
}
async function getTable(table, select='*', query='') {
  const c = cfg();
  const r = await fetch(c.url + '/rest/v1/' + table + '?select=' + encodeURIComponent(select) + (query ? '&' + query : ''), {
    headers: { apikey:c.key, Authorization:'Bearer '+c.key }
  });
  const text = await r.text();
  if (!r.ok) throw new Error(table + ' HTTP ' + r.status + ': ' + text.slice(0,500));
  return JSON.parse(text || '[]');
}
function hash(v) { return crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex'); }
function write(file, value) {
  fs.mkdirSync(OUT, { recursive:true });
  fs.writeFileSync(file, JSON.stringify(value,null,2)+'\n','utf8');
}
function blocker(id, category, description, canCodeRemove, externalDependency, dependencies, status, nextAction, evidenceRequired, automationReady) {
  return { blocker_id:id, category, description, can_code_remove:canCodeRemove, external_dependency:externalDependency, dependencies, status, next_action:nextAction, evidence_required:evidenceRequired, automation_ready:automationReady };
}

async function main() {
  const [cells, actions, outcomes, events, fulfillment, actuators, experiments, transitions, interventions] = await Promise.all([
    getTable('commerce_cells','cell_id,sku,product_id,offer_id,name,state,canonical_state,approval_required,verified_checkout,verified_fulfillment,verified_webhook,checkout_url,metadata'),
    getTable('economic_actions','action_id,cell_id,action_type,authorization_state,execution_state,expires_at,external_reference,evidence_reference,actuator_id,idempotency_key'),
    getTable('economic_outcomes','outcome_id,cell_id,action_id,outcome_type,amount_nzd,truth_status,attribution,external_reference,evidence_ids,observed_at'),
    getTable('economic_events','event_id,silo_id,sku_id,offer_id,buyer_action_verified,payment_settled,fulfilment_verified,evidence_verified,amount_nzd,stripe_checkout_session,stripe_payment_intent,verification_status,observation_mode,scope,event_timestamp'),
    getTable('fulfillment_requests','id,sku_id,status,canonical_state,manual_fulfillment,fulfillment_reference,confirmation_reference,evidence_reference,evidence_status'),
    getTable('economic_actuators','actuator_id,action_types,status,external_system,credential_requirement,last_observed_at,evidence_reference'),
    getTable('control_experiments','experiment_id,cell_id,target,offer,channel,status,result,next_action'),
    getTable('economic_transitions','transition_id,offer_id,from_state,to_state,outcome,idempotency_key,executed_at,verified_at'),
    getTable('economic_human_interventions','intervention_id,cell_id,action_id,intervention_type,reason,occurred_at,actor')
  ]);

  const verified = outcomes.filter(x=>x.truth_status==='VERIFIED');
  const buyers = new Set(verified.map(x=>x.attribution && x.attribution.buyer_key).filter(Boolean));
  const readyCells = cells.filter(x=>x.canonical_state==='READY');
  const blockers = [];

  if (!verified.length) blockers.push(blocker(
    'BT-REAL-EVENT-001','EXTERNAL_REALITY_BLOCKER',
    'No independently verified economic outcome exists in the authoritative outcome ledger.',
    false,'REAL_EXTERNAL_BUYER + SETTLED_PAYMENT + ATTRIBUTION + FULFILLMENT',
    ['external buyer','settled transaction','fulfillment evidence'],'BLOCKED',
    'Drive the existing ready offer through its real external checkout and record the resulting webhook/fulfillment evidence.',
    ['Stripe live payment','buyer identity/association','fulfillment evidence'],false
  ));
  if (!events.some(x=>x.payment_settled && x.scope==='EXTERNAL' && x.observation_mode==='OBSERVED')) blockers.push(blocker(
    'BT-STRIPE-EVIDENCE-001','EXTERNAL_REALITY_BLOCKER',
    'No external observed settled payment is present in economic_events.',
    false,'Stripe live settlement event',
    ['verified webhook','payment intent','explicit attribution'],'BLOCKED',
    'Observe a real live settlement through the canonical webhook path.',
    ['checkout.session.completed','payment_intent','live mode'],false
  ));
  if (!fulfillment.some(x=>['FULFILLED','CONFIRMATION','EVIDENCE'].includes(x.canonical_state))) blockers.push(blocker(
    'BT-FULFILLMENT-001','EXTERNAL_REALITY_BLOCKER',
    'No fulfillment record has reached the canonical fulfilled/confirmation/evidence stages.',
    false,'Actual buyer order must exist first',
    ['settled payment','fulfillment request'],'BLOCKED',
    'Fulfill the first real paid order and record the fulfillment reference and evidence.',
    ['fulfillment reference','confirmation','evidence'],false
  ));
  if (!cells.some(x=>x.canonical_state==='READY')) blockers.push(blocker(
    'ENG-CELL-READY-001','ENGINEERING_BLOCKER',
    'No economic cell is currently READY under the canonical state model.',
    true,'None',
    ['cell configuration'],'BLOCKED',
    'Harden the cell contract or offer configuration until one cell is READY.', ['canonical cell fields'],true
  ));
  if (actions.some(x=>x.execution_state==='ACTUATOR_UNAVAILABLE')) blockers.push(blocker(
    'ENG-ACTUATOR-001','ENGINEERING_BLOCKER',
    'At least one prepared action has no available actuator.',
    true,'Specific external platform credential/connection',
    ['action contract','authorized actuator'],'BLOCKED',
    'Keep the action prepared and bind an authorized actuator only when the external credential/connection exists.',
    ['actuator status','credential authority'],true
  ));
  if (transitions.some(x=>!x.idempotency_key)) blockers.push(blocker(
    'ENG-IDEMPOTENCY-001','ENGINEERING_BLOCKER',
    'A governed transition is missing an idempotency key.',
    true,'None',
    ['transition ledger'],'BLOCKED',
    'Reject or repair the transition before execution.', ['unique idempotency key'],true
  ));

  const verifiedRevenue = verified.reduce((n,x)=>n+Number(x.amount_nzd||0),0);
  const report = {
    report_schema:'ECONOMIC_CONTROL_REPORT_V1',
    generated_at:new Date().toISOString(),
    CURRENT_STATE: verified.length ? 'VERIFIED' : (readyCells.length ? 'READY' : 'BLOCKED'),
    VERIFIED_REVENUE: verifiedRevenue,
    VERIFIED_PAYMENTS: verified.length,
    INDEPENDENT_BUYERS: buyers.size,
    ACTIVE_CELL: cells.find(x=>x.canonical_state==='ACTIVE')?.cell_id || null,
    READY_CELLS: readyCells.map(x=>({cell_id:x.cell_id,sku:x.sku,offer_id:x.offer_id,name:x.name})),
    QUARANTINED_CELLS: cells.filter(x=>x.canonical_state==='QUARANTINED').map(x=>x.cell_id),
    REPLICABLE_CELLS: cells.filter(x=>x.canonical_state==='REPLICABLE').map(x=>x.cell_id),
    NEXT_EXTERNAL_TRANSITION: verified.length ? 'REPLICATION_OR_NEXT_BUYER' : (readyCells.length ? 'REAL_EXTERNAL_CHECKOUT' : 'ENGINEERING_REPAIR'),
    BLOCKERS:blockers,
    AUTOMATION_COVERAGE:{
      economic_actions:actions.length,
      succeeded_actions:actions.filter(x=>x.execution_state==='SUCCEEDED').length,
      prepared_or_authorized:actions.filter(x=>['PREPARED','AUTHORITY_REQUIRED','AUTHORIZED'].includes(x.execution_state)).length,
      automated_fulfillment_records:fulfillment.filter(x=>x.manual_fulfillment===false).length,
      manual_fulfillment_records:fulfillment.filter(x=>x.manual_fulfillment===true).length,
      human_interventions:interventions.length
    },
    HUMAN_AUTHORITY_REQUIREMENTS:actions.filter(x=>x.authorization_state==='AUTHORITY_REQUIRED').map(x=>x.action_id),
    ACTUATOR_STATUS:actuators,
    EVIDENCE_STATUS:{
      economic_events:events.length,
      externally_observed_settlements:events.filter(x=>x.payment_settled&&x.scope==='EXTERNAL'&&x.observation_mode==='OBSERVED').length,
      fulfilled_outcomes:fulfillment.filter(x=>['FULFILLED','CONFIRMATION','EVIDENCE'].includes(x.canonical_state)).length
    },
    GAUNTLET_STATUS:{
      experiments:experiments.length,
      blocked_cells:cells.filter(x=>x.canonical_state==='BLOCKED').length,
      governed_transitions:transitions.length
    },
    LAST_VERIFIED_AT:verified.reduce((latest,x)=>!latest || x.observed_at>latest?x.observed_at:latest,null)
  };
  const blockerReport = { schema:'BLOCKER_COMPILER_V1', generated_at:report.generated_at, blockers, engineering_blockers:blockers.filter(x=>x.category==='ENGINEERING_BLOCKER'), external_reality_blockers:blockers.filter(x=>x.category==='EXTERNAL_REALITY_BLOCKER') };
  const proof = {
    schema:'ECONOMIC_FINAL_GAP_IMPLEMENTATION_PROOF_V1',
    generated_at:report.generated_at,
    sha256:hash({report,blockerReport}),
    implementation:'canonical cell + action contract + business truth + actuator registry + fulfillment evidence fields + attribution + replication + agent contract + control report',
    repository:'KelpCoin/DreamLedger',
    source_branch:process.env.GITHUB_REF_NAME||'unknown',
    tests:'BEC-PRIME/economic/EconomicFinalGap.test.js',
    verified_revenue:report.VERIFIED_REVENUE,
    verified_payments:report.VERIFIED_PAYMENTS,
    blockers:report.BLOCKERS.length,
    external_reality_blockers:blockerReport.external_reality_blockers.length
  };
  write(REPORT,report); write(BLOCKERS,blockerReport); write(PROOF,proof);
  console.log(JSON.stringify({report_path:REPORT,blocker_path:BLOCKERS,proof_path:PROOF,report,proof},null,2));
}
main().catch(err=>{console.error(err.stack||String(err));process.exit(1);});
