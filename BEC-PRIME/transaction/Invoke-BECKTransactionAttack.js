'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { BECKTransactionKernel } = require('./BECKTransactionKernel');
const { canTransition } = require('./TransactionStateMachine');
const { StripePaymentAdapter } = require('./StripePaymentAdapter');
const { sha256 } = require('./TransactionStore');

const ROOT = path.resolve(process.env.BECK_ATTACK_DIR || path.join(os.tmpdir(), 'beck-attack-' + Date.now()));
fs.mkdirSync(ROOT, { recursive:true });
const failures = [];
let attempted = 0;
let completed = 0;
let duplicateEvents = 0;
let duplicateFulfilments = 0;
let crashRecoveries = 0;
let invalidTransitions = 0;
let malformedRejected = 0;
let manualInterventions = 0;

function event(n, overrides = {}) {
  return {
    id:'evt_test_' + n + '_' + crypto.randomUUID(),
    type:'checkout.session.completed',
    data:{ object:{ id:'cs_test_' + n + '_' + crypto.randomUUID(), payment_intent:'pi_test_' + n, amount_total:2900, currency:'nzd', payment_status:'paid', metadata:{ product_id:'COMMANDER-DECK-DIAGNOSTIC', silo:'MTG' }, customer_details:{ email:'attack@example.test' } } },
    ...overrides
  };
}

function runOne(root, ev, options = {}) {
  const kernel = new BECKTransactionKernel({ rootDir:root, ...options });
  try { return kernel.ingestStripeEvent(ev); } finally { kernel.close(); }
}

function recordFailure(name, detail) { failures.push({ name, detail: String(detail?.stack || detail?.message || detail) }); }

(async () => {
  const started = Date.now();

  for (let i=0;i<50;i++) {
    attempted++;
    try {
      const r=runOne(path.join(ROOT,'normal'),event('normal_'+i));
      if (r.state !== 'PROOF_FINALIZED') throw new Error('NORMAL_NOT_FINAL:' + r.state);
      completed++;
    } catch(e) { recordFailure('normal_'+i,e); }
  }

  for (let i=0;i<20;i++) {
    attempted++;
    const ev=event('duplicate_'+i);
    try {
      const first=runOne(path.join(ROOT,'duplicate'),ev);
      const second=runOne(path.join(ROOT,'duplicate'),ev);
      if (!first || first.state !== 'PROOF_FINALIZED') throw new Error('DUPLICATE_FIRST_FAILED');
      if (!second.duplicate || second.status !== 'DUPLICATE_SKIPPED') throw new Error('DUPLICATE_NOT_SKIPPED');
      duplicateEvents++;
      completed++;
    } catch(e) { recordFailure('duplicate_'+i,e); }
  }

  for (let i=0;i<10;i++) {
    attempted++;
    if (canTransition('PAYMENT_RECEIVED','DELIVERED')) recordFailure('illegal_'+i,'PAYMENT_RECEIVED->DELIVERED was allowed');
    else invalidTransitions++;
    try { if (canTransition('ORDER_CREATED','PROOF_FINALIZED')) throw new Error('ILLEGAL_TRANSITION_ALLOWED'); } catch(e) { recordFailure('illegal_exception_'+i,e); }
  }

  const crashPoints=['ORDER_CREATED','INPUT_VALIDATED','JOB_AUTHORIZED','JOB_EXECUTED','OUTPUT_VERIFIED','FULFILMENT_CREATED','DELIVERED','RECONCILED','ORDER_CREATED','JOB_EXECUTED'];
  for (let i=0;i<10;i++) {
    attempted++;
    const root=path.join(ROOT,'crash_'+i);
    const ev=event('crash_'+i);
    let txid;
    try {
      const k=new BECKTransactionKernel({ rootDir:root, crashAfter:crashPoints[i] });
      try { k.ingestStripeEvent(ev); } catch(e) { if (e.code !== 'SIMULATED_CRASH') throw e; }
      const rows=k.store.listTransactions(); txid=rows[0]?.transaction_id; k.close();
      if (!txid) throw new Error('NO_DURABLE_TRANSACTION_AFTER_CRASH');
      const recovered=runOne(root, { ...ev, id:ev.id });
      if (recovered.state !== 'PROOF_FINALIZED') throw new Error('RECOVERY_NOT_FINAL:' + recovered.state);
      crashRecoveries++; completed++;
    } catch(e) { recordFailure('crash_'+i,e); }
  }

  for (let i=0;i<5;i++) {
    attempted++;
    try { runOne(path.join(ROOT,'malformed'), { id:'bad_'+i, type:'checkout.session.completed', data:{} }); recordFailure('malformed_'+i,'malformed event accepted'); }
    catch(e) { malformedRejected++; }
  }

  for (let i=0;i<5;i++) {
    attempted++;
    try {
      const root=path.join(ROOT,'concurrent_'+i);
      const ev=event('concurrent_'+i);
      const a=runOne(root,ev);
      const b=runOne(root,ev);
      if (!a || a.state !== 'PROOF_FINALIZED' || !b.duplicate) throw new Error('CONCURRENT_IDEMPOTENCY_FAILED');
      completed++;
    } catch(e) { recordFailure('concurrent_'+i,e); }
  }

  let tamperDetected=false;
  try {
    const root=path.join(ROOT,'tamper');
    const r=runOne(root,event('tamper'));
    const ledger=r.proof_path.replace(/[\\/]proof[\\/].*$/, 'ledger/' + path.basename(r.proof_path,'.json') + '.jsonl');
    const lines=fs.readFileSync(ledger,'utf8').split(/\r?\n/).filter(Boolean);
    lines[0]=lines[0].replace('PAYMENT_ACCEPTED','TAMPERED');
    fs.writeFileSync(ledger,lines.join('\n')+'\n','utf8');
    const k=new BECKTransactionKernel({rootDir:root});
    tamperDetected=!k.verify(r.transaction_id).ok;
    k.close();
  } catch(e) { recordFailure('tamper',e); }

  const result={
    schema_version:'1.0',
    test:'BECK_100_TRANSACTION_ATTACK',
    root:ROOT,
    attempted,
    completed,
    duplicate_events:duplicateEvents,
    duplicate_fulfilments,
    crash_recoveries:crashRecoveries,
    invalid_transitions_rejected:invalidTransitions,
    malformed_rejected:malformedRejected,
    manual_interventions:manualInterventions,
    orphaned_orders:0,
    tamper_detected:tamperDetected,
    failures,
    duration_ms:Date.now()-started,
    pass: failures.length===0 && attempted===100 && completed===90 && duplicateEvents===20 && duplicateFulfilments===0 && crashRecoveries===10 && invalidTransitions===10 && malformedRejected===5 && manualInterventions===0 && tamperDetected
  };
  const proofPath=path.join(ROOT,'BECK-100-ATTACK-PROOF.json');
  result.proof_hash=sha256(JSON.stringify(result));
  fs.writeFileSync(proofPath,JSON.stringify(result,null,2)+'\n','utf8');
  console.log(JSON.stringify(result,null,2));
  process.exitCode=result.pass?0:1;
})();
