'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');

function sha256(value) { return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex'); }

class TransactionStore {
  constructor(rootDir) {
    this.rootDir = path.resolve(rootDir);
    this.ledgerDir = path.join(this.rootDir, 'ledger');
    this.proofDir = path.join(this.rootDir, 'proof');
    fs.mkdirSync(this.ledgerDir, { recursive: true });
    fs.mkdirSync(this.proofDir, { recursive: true });
    this.db = new DatabaseSync(path.join(this.rootDir, 'beck.sqlite'));
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS inbox (
        stripe_event_id TEXT PRIMARY KEY,
        received_at TEXT NOT NULL,
        event_type TEXT NOT NULL,
        transaction_id TEXT NOT NULL,
        processed_at TEXT,
        status TEXT NOT NULL DEFAULT 'RECEIVED'
      );
      CREATE TABLE IF NOT EXISTS transactions (
        transaction_id TEXT PRIMARY KEY,
        stripe_event_id TEXT NOT NULL,
        payment_intent_id TEXT,
        order_id TEXT NOT NULL,
        operation_id TEXT,
        state TEXT NOT NULL,
        sku TEXT,
        amount_minor INTEGER NOT NULL,
        currency TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
  }

  beginInbox(event) {
    const transactionId = String(event.data?.object?.id || event.id);
    const now = new Date().toISOString();
    try {
      this.db.prepare('BEGIN IMMEDIATE').run();
      this.db.prepare('INSERT INTO inbox(stripe_event_id,received_at,event_type,transaction_id) VALUES(?,?,?,?)').run(String(event.id), now, String(event.type || ''), transactionId);
      this.db.prepare('COMMIT').run();
      return { duplicate: false, transaction_id: transactionId };
    } catch (error) {
      try { this.db.prepare('ROLLBACK').run(); } catch {}
      if (String(error.message).includes('UNIQUE constraint failed: inbox.stripe_event_id')) return { duplicate: true, transaction_id: transactionId };
      throw error;
    }
  }

  markInboxProcessed(eventId, status) {
    this.db.prepare('UPDATE inbox SET processed_at=?, status=? WHERE stripe_event_id=?').run(new Date().toISOString(), status, eventId);
  }

  getTransaction(transactionId) { return this.db.prepare('SELECT * FROM transactions WHERE transaction_id=?').get(transactionId) || null; }

  upsertTransaction(tx) {
    this.db.prepare(`INSERT INTO transactions(transaction_id,stripe_event_id,payment_intent_id,order_id,operation_id,state,sku,amount_minor,currency,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(transaction_id) DO UPDATE SET stripe_event_id=excluded.stripe_event_id,payment_intent_id=excluded.payment_intent_id,
      order_id=excluded.order_id,operation_id=excluded.operation_id,state=excluded.state,sku=excluded.sku,amount_minor=excluded.amount_minor,
      currency=excluded.currency,updated_at=excluded.updated_at`).run(tx.transaction_id, tx.stripe_event_id, tx.payment_intent_id || null, tx.order_id, tx.operation_id || null, tx.state, tx.sku, tx.amount_minor, tx.currency, new Date().toISOString());
  }

  appendTransition(event) {
    const file = path.join(this.ledgerDir, event.transaction_id + '.jsonl');
    let previous = 'GENESIS';
    if (fs.existsSync(file)) {
      const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean);
      if (lines.length) previous = JSON.parse(lines[lines.length - 1]).event_hash;
    }
    const base = { schema_version:'1.0', event_id:event.event_id, event_type:'TRANSITION', timestamp:new Date().toISOString(), ...event, previous_event_hash:previous };
    delete base.event_hash;
    const eventHash = sha256(JSON.stringify(base));
    const record = { ...base, event_hash:eventHash };
    fs.appendFileSync(file, JSON.stringify(record) + '\n', { encoding:'utf8' });
    return record;
  }

  listTransactions() { return this.db.prepare('SELECT * FROM transactions ORDER BY updated_at').all(); }

  writeProof(proof) {
    const payload = { schema_version:'1.0', ...proof };
    const proofHash = sha256(JSON.stringify(payload));
    const final = { ...payload, proof_hash:proofHash };
    const file = path.join(this.proofDir, proof.transaction_id + '.json');
    fs.writeFileSync(file, JSON.stringify(final, null, 2) + '\n', { encoding:'utf8' });
    return { path:file, proof_hash:proofHash };
  }

  verifyLedger(transactionId) {
    const file = path.join(this.ledgerDir, transactionId + '.jsonl');
    if (!fs.existsSync(file)) return { ok:false, reason:'LEDGER_MISSING' };
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean);
    let previous = 'GENESIS';
    for (const line of lines) {
      const item = JSON.parse(line);
      if (item.previous_event_hash !== previous) return { ok:false, reason:'HASH_CHAIN_BROKEN', event_id:item.event_id };
      const copy = { ...item }; delete copy.event_hash;
      if (sha256(JSON.stringify(copy)) !== item.event_hash) return { ok:false, reason:'EVENT_HASH_MISMATCH', event_id:item.event_id };
      previous = item.event_hash;
    }
    return { ok:true, events:lines.length, last_event_hash:previous };
  }

  recoverIncomplete() {
    const rows = this.listTransactions();
    return rows.filter(row => !['PROOF_FINALIZED','PAYMENT_REJECTED','ORDER_CANCELLED','AUTHORIZATION_DENIED','REFUNDED','QUARANTINED','MANUAL_REVIEW'].includes(row.state));
  }

  close() { this.db.close(); }
}

module.exports = { TransactionStore, sha256 };
