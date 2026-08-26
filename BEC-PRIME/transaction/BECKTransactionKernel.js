'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { assertTransition, TERMINAL } = require('./TransactionStateMachine');
const { TransactionStore } = require('./TransactionStore');

function id(prefix) { return prefix + '_' + crypto.randomUUID(); }

class DefaultGovernor {
  authorize(ctx) {
    if (ctx.silo !== 'MTG' && ctx.silo !== 'dreamledger') throw new Error('GOVERNOR_DENY_SILO');
    if (!ctx.sku) throw new Error('GOVERNOR_DENY_NO_SKU');
    return { allowed:true, policy_version:'BECK-GOVERNOR-1', capability:'DIAGNOSTIC_GENERATION' };
  }
}

class MockFulfilmentAdapter {
  constructor(rootDir) { this.rootDir = rootDir; }
  validateInput(ctx) { return { valid:true, customer_email:ctx.customer_email || null }; }
  execute(ctx) {
    const dir = path.join(this.rootDir, 'outputs'); fs.mkdirSync(dir, { recursive:true });
    const file = path.join(dir, ctx.transaction_id + '.json');
    if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify({ transaction_id:ctx.transaction_id, sku:ctx.sku, diagnostic:'PASS', generated_at:new Date().toISOString() }, null, 2) + '\n', { flag:'wx' });
    return { output_path:file, output_hash:require('./TransactionStore').sha256(fs.readFileSync(file, 'utf8')) };
  }
  verifyOutput(ctx) {
    if (!ctx.output_path || !fs.existsSync(ctx.output_path)) return { valid:false };
    const value = JSON.parse(fs.readFileSync(ctx.output_path, 'utf8'));
    return { valid:value.transaction_id === ctx.transaction_id && value.sku === ctx.sku, output_hash:require('./TransactionStore').sha256(fs.readFileSync(ctx.output_path, 'utf8')) };
  }
  createFulfilment(ctx) {
    const file = path.join(this.rootDir, 'fulfilment', ctx.transaction_id + '.json'); fs.mkdirSync(path.dirname(file), { recursive:true });
    if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify({ fulfilment_id:id('ful'), transaction_id:ctx.transaction_id, artifact_path:ctx.output_path }, null, 2) + '\n', { flag:'wx' });
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  }
  deliver(ctx) {
    const file = path.join(this.rootDir, 'delivery', ctx.transaction_id + '.json'); fs.mkdirSync(path.dirname(file), { recursive:true });
    if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify({ operation_id:ctx.operation_id, delivered:true, delivered_at:new Date().toISOString(), artifact_path:ctx.output_path }, null, 2) + '\n', { flag:'wx' });
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  }
  reconcile(ctx) { return { reconciled:true, amount_minor:ctx.amount_minor, currency:ctx.currency }; }
}

class BECKTransactionKernel {
  constructor(options = {}) {
    this.rootDir = path.resolve(options.rootDir || path.join(__dirname, '..', 'data', 'beck'));
    this.store = options.store || new TransactionStore(this.rootDir);
    this.governor = options.governor || new DefaultGovernor();
    this.fulfilment = options.fulfilment || new MockFulfilmentAdapter(this.rootDir);
    this.crashAfter = options.crashAfter || null;
  }

  _crash(point) { if (this.crashAfter === point) throw Object.assign(new Error('SIMULATED_CRASH:' + point), { code:'SIMULATED_CRASH', point }); }

  _transition(tx, to, reason, evidence = {}) {
    assertTransition(tx.state, to);
    const event = this.store.appendTransition({ event_id:id('evt'), transaction_id:tx.transaction_id, stripe_event_id:tx.stripe_event_id, payment_intent_id:tx.payment_intent_id, order_id:tx.order_id, operation_id:tx.operation_id, from_state:tx.state, to_state:to, reason, actor:'BECK_KERNEL', ...evidence });
    tx.state = to;
    this.store.upsertTransaction(tx);
    return event;
  }

  ingestStripeEvent(event) {
    if (!event?.id || !event?.type || !event?.data?.object) throw new Error('INVALID_STRIPE_EVENT');
    const inbox = this.store.beginInbox(event);
    if (inbox.duplicate) return { ok:true, duplicate:true, stripe_event_id:event.id, transaction_id:inbox.transaction_id, status:'DUPLICATE_SKIPPED' };
    const session = event.data.object;
    const tx = { transaction_id:String(session.id || event.id), stripe_event_id:String(event.id), payment_intent_id:session.payment_intent || null, order_id:id('ord'), operation_id:id('op'), state:'PAYMENT_RECEIVED', sku:String(session.metadata?.product_id || session.metadata?.sku || 'COMMANDER-DECK-DIAGNOSTIC'), amount_minor:Number(session.amount_total || 0), currency:String(session.currency || 'nzd').toUpperCase(), silo:String(session.metadata?.silo || 'MTG'), customer_email:session.customer_details?.email || null };
    this.store.upsertTransaction(tx);
    this._transition({ ...tx, state:'PAYMENT_RECEIVED' }, 'ORDER_CREATED', 'PAYMENT_ACCEPTED');
    this._crash('ORDER_CREATED');
    return this.resume(tx.transaction_id);
  }

  resume(transactionId) {
    let tx = this.store.getTransaction(transactionId);
    if (!tx) throw new Error('TRANSACTION_NOT_FOUND:' + transactionId);
    const extra = this._readContext(tx);
    tx = Object.assign(tx, extra);
    if (TERMINAL.has(tx.state)) return { ok:true, transaction_id:tx.transaction_id, state:tx.state, terminal:true };
    while (!TERMINAL.has(tx.state)) {
      switch (tx.state) {
        case 'ORDER_CREATED': {
          const validation = this.fulfilment.validateInput(tx); if (!validation.valid) { this._transition(tx,'INPUT_INVALID','INPUT_VALIDATION_FAILED',validation); return { ok:false, state:tx.state }; }
          this._transition(tx,'INPUT_VALIDATED','INPUT_VALIDATION_PASSED',validation); this._crash('INPUT_VALIDATED'); break;
        }
        case 'INPUT_VALIDATED': {
          try { const auth=this.governor.authorize(tx); this._transition(tx,'JOB_AUTHORIZED','GOVERNOR_ALLOW',auth); } catch(e) { this._transition(tx,'AUTHORIZATION_DENIED',e.message); }
          this._crash('JOB_AUTHORIZED'); break;
        }
        case 'JOB_AUTHORIZED': {
          try { const out=this.fulfilment.execute(tx); Object.assign(tx,out); this._transition(tx,'JOB_EXECUTED','EXECUTION_COMPLETE',out); } catch(e) { this._transition(tx,'JOB_FAILED',e.message); return { ok:false,state:tx.state }; }
          this._crash('JOB_EXECUTED'); break;
        }
        case 'JOB_EXECUTED': {
          const out=this.fulfilment.verifyOutput(tx); if (!out.valid) { this._transition(tx,'OUTPUT_INVALID','OUTPUT_SCHEMA_INVALID',out); return { ok:false,state:tx.state }; }
          Object.assign(tx,out); this._transition(tx,'OUTPUT_VERIFIED','OUTPUT_SCHEMA_VALID',out); this._crash('OUTPUT_VERIFIED'); break;
        }
        case 'OUTPUT_VERIFIED': {
          const f=this.fulfilment.createFulfilment(tx); Object.assign(tx,{fulfilment_id:f.fulfilment_id}); this._transition(tx,'FULFILMENT_CREATED','FULFILMENT_CREATED',f); this._crash('FULFILMENT_CREATED'); break;
        }
        case 'FULFILMENT_CREATED': { this._transition(tx,'DELIVERY_PENDING','DELIVERY_READY'); break; }
        case 'DELIVERY_PENDING': {
          const d=this.fulfilment.deliver(tx); Object.assign(tx,{delivery_operation_id:d.operation_id}); this._transition(tx,'DELIVERED','DELIVERY_CONFIRMED',d); this._crash('DELIVERED'); break;
        }
        case 'DELIVERED': { this._transition(tx,'RECONCILIATION_PENDING','DELIVERY_RECORDED'); break; }
        case 'RECONCILIATION_PENDING': { const r=this.fulfilment.reconcile(tx); Object.assign(tx,r); this._transition(tx,'RECONCILED','RECONCILIATION_PASSED',r); this._crash('RECONCILED'); break; }
        case 'RECONCILED': {
          const proof=this.store.writeProof({ proof_id:id('proof'), transaction_id:tx.transaction_id, order_id:tx.order_id, payment_intent_id:tx.payment_intent_id, amount_minor:tx.amount_minor, currency:tx.currency, sku:tx.sku, state_history:this._history(tx.transaction_id), fulfilment_artifact_hash:tx.output_hash || null, policy_version:'BECK-GOVERNOR-1' });
          Object.assign(tx,{proof_path:proof.path,proof_hash:proof.proof_hash}); this._transition(tx,'PROOF_FINALIZED','PROOF_WRITTEN',proof); break;
        }
        default: throw new Error('UNHANDLED_STATE:' + tx.state);
      }
    }
    this.store.markInboxProcessed(tx.stripe_event_id, tx.state);
    return { ok:true, transaction_id:tx.transaction_id, state:tx.state, proof_path:tx.proof_path, proof_hash:tx.proof_hash };
  }

  _history(transactionId) {
    const file=path.join(this.store.ledgerDir, transactionId + '.jsonl');
    if (!fs.existsSync(file)) return [];
    return fs.readFileSync(file,'utf8').split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line)).map(e=>({from:e.from_state,to:e.to_state,timestamp:e.timestamp}));
  }

  _readContext(tx) {
    const output=path.join(this.rootDir,'outputs',tx.transaction_id+'.json');
    const fulfil=path.join(this.rootDir,'fulfilment',tx.transaction_id+'.json');
    const delivery=path.join(this.rootDir,'delivery',tx.transaction_id+'.json');
    const out={ output_path:output };
    if (fs.existsSync(output)) out.output_hash=require('./TransactionStore').sha256(fs.readFileSync(output,'utf8'));
    if (fs.existsSync(fulfil)) out.fulfilment_id=JSON.parse(fs.readFileSync(fulfil,'utf8')).fulfilment_id;
    if (fs.existsSync(delivery)) out.delivery_operation_id=JSON.parse(fs.readFileSync(delivery,'utf8')).operation_id;
    return out;
  }

  recoverAll() { return this.store.recoverIncomplete().map(row => this.resume(row.transaction_id)); }
  verify(transactionId) { return this.store.verifyLedger(transactionId); }
  close() { this.store.close(); }
}

module.exports = { BECKTransactionKernel, DefaultGovernor, MockFulfilmentAdapter };
