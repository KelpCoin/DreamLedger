'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const DATA_ROOT = path.resolve(process.env.LEDGER_DATA_DIR || path.join(ROOT, 'data', 'transactions'));
const EVENT_FILE = path.join(DATA_ROOT, 'ledger-events.jsonl');
const JOURNAL_FILE = path.join(DATA_ROOT, 'journal-entries.jsonl');
const LINE_FILE = path.join(DATA_ROOT, 'ledger-entries.jsonl');
const FULFILLMENT_FILE = path.join(DATA_ROOT, 'fulfillment.jsonl');

const ACCOUNTS = Object.freeze({
  STRIPE_CLEARING: { code: '1001', type: 'asset', name: 'Stripe Clearing' },
  CASH: { code: '1002', type: 'asset', name: 'Cash' },
  ACCOUNTS_RECEIVABLE: { code: '1100', type: 'asset', name: 'Accounts Receivable' },
  DEFERRED_REVENUE: { code: '2100', type: 'liability', name: 'Deferred Revenue' },
  SALES_REVENUE: { code: '4000', type: 'income', name: 'Sales Revenue' },
  PROCESSING_FEES: { code: '5000', type: 'expense', name: 'Payment Processing Fees' },
  REFUNDS: { code: '4100', type: 'contra_income', name: 'Refunds and Credits' }
});

function ensure() {
  fs.mkdirSync(DATA_ROOT, { recursive: true });
}

function appendUnique(file, key, value) {
  ensure();
  const lines = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean) : [];
  if (lines.some(line => { try { return JSON.parse(line)[key] === value; } catch { return false; } })) return false;
  fs.appendFileSync(file, JSON.stringify(value) + '\n', 'utf8');
  return true;
}

function readLines(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
}

function hash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');
}

function eventAlreadyProcessed(eventId) {
  return readLines(EVENT_FILE).some(event => event.event_id === eventId);
}

function recordEvent(event) {
  ensure();
  if (eventAlreadyProcessed(event.event_id)) return { recorded: false, duplicate: true };
  const stored = {
    event_id: event.event_id,
    event_type: event.event_type,
    transaction_id: event.transaction_id || null,
    occurred_at: event.occurred_at || new Date().toISOString(),
    payload_hash: event.payload_hash || hash(event.payload || event),
    source: event.source || 'stripe.webhook'
  };
  fs.appendFileSync(EVENT_FILE, JSON.stringify(stored) + '\n', 'utf8');
  return { recorded: true, duplicate: false, event: stored };
}

function postJournal({ journalId, eventId, description, currency, lines, metadata = {} }) {
  const totalDebit = lines.reduce((n, line) => n + (line.debit || 0), 0);
  const totalCredit = lines.reduce((n, line) => n + (line.credit || 0), 0);
  if (totalDebit !== totalCredit || totalDebit <= 0) throw new Error('Unbalanced journal entry');
  const journal = {
    journal_id: journalId,
    event_id: eventId,
    description,
    currency: String(currency || 'NZD').toUpperCase(),
    total_debit_minor: totalDebit,
    total_credit_minor: totalCredit,
    metadata,
    created_at: new Date().toISOString()
  };
  if (!appendUnique(JOURNAL_FILE, 'journal_id', journalId)) return { duplicate: true, journal };
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const account = ACCOUNTS[line.account];
    if (!account) throw new Error(`Unknown ledger account: ${line.account}`);
    const entry = {
      ledger_entry_id: `${journalId}-${i + 1}`,
      journal_id: journalId,
      event_id: eventId,
      account_code: account.code,
      account_name: account.name,
      account_type: account.type,
      debit_minor: line.debit || 0,
      credit_minor: line.credit || 0,
      currency: journal.currency,
      created_at: journal.created_at
    };
    appendUnique(LINE_FILE, 'ledger_entry_id', entry);
  }
  return { duplicate: false, journal };
}

function recordPayment({ eventId, transactionId, amountMinor, currency, productId, offerId, silo }) {
  const amount = Number(amountMinor);
  if (!Number.isInteger(amount) || amount <= 0) throw new Error('Payment amount must be a positive integer in minor units');
  const event = recordEvent({
    event_id: eventId,
    event_type: 'payment_received',
    transaction_id: transactionId,
    payload: { amount, currency, productId, offerId, silo }
  });
  if (event.duplicate) return { duplicate: true, event_id: eventId };
  const journal = postJournal({
    journalId: `JE-PAY-${transactionId}`,
    eventId,
    description: 'Stripe payment received; hold as deferred revenue until fulfillment',
    currency,
    metadata: { transaction_id: transactionId, product_id: productId || null, offer_id: offerId || null, silo },
    lines: [
      { account: 'STRIPE_CLEARING', debit: amount },
      { account: 'DEFERRED_REVENUE', credit: amount }
    ]
  });
  return { duplicate: false, event_id: eventId, journal_id: journal.journal.journal_id };
}

function recordFulfillment({ eventId, transactionId, amountMinor, currency, fulfillmentId, productId, offerId, silo }) {
  const amount = Number(amountMinor);
  if (!Number.isInteger(amount) || amount <= 0) throw new Error('Fulfillment amount must be a positive integer in minor units');
  const event = recordEvent({
    event_id: eventId,
    event_type: 'fulfillment_completed',
    transaction_id: transactionId,
    payload: { amount, currency, fulfillmentId, productId, offerId, silo }
  });
  if (event.duplicate) return { duplicate: true, event_id: eventId };
  const journal = postJournal({
    journalId: `JE-REV-${fulfillmentId}`,
    eventId,
    description: 'Fulfillment completed; recognize earned revenue',
    currency,
    metadata: { transaction_id: transactionId, fulfillment_id: fulfillmentId, product_id: productId || null, offer_id: offerId || null, silo },
    lines: [
      { account: 'DEFERRED_REVENUE', debit: amount },
      { account: 'SALES_REVENUE', credit: amount }
    ]
  });
  return { duplicate: false, event_id: eventId, journal_id: journal.journal.journal_id };
}

function createFulfillment({ transactionId, productId, offerId, silo, amountMinor, currency, customerEmail }) {
  ensure();
  const fulfillmentId = `FUL-${transactionId}`;
  const existing = readLines(FULFILLMENT_FILE).find(item => item.fulfillment_id === fulfillmentId);
  if (existing) return { created: false, fulfillment: existing };
  const fulfillment = {
    fulfillment_id: fulfillmentId,
    transaction_id: transactionId,
    product_id: productId || null,
    offer_id: offerId || null,
    silo,
    fulfillment_type: 'digital_service',
    status: 'READY_FOR_DELIVERY',
    amount_minor: Number(amountMinor),
    currency: String(currency || 'NZD').toUpperCase(),
    customer_email: customerEmail || null,
    created_at: new Date().toISOString()
  };
  fs.appendFileSync(FULFILLMENT_FILE, JSON.stringify(fulfillment) + '\n', 'utf8');
  return { created: true, fulfillment };
}

function health() {
  ensure();
  const journals = readLines(JOURNAL_FILE);
  const entries = readLines(LINE_FILE);
  const events = readLines(EVENT_FILE);
  const balance = entries.reduce((n, line) => n + (line.debit_minor || 0) - (line.credit_minor || 0), 0);
  return {
    schema: 'BEC-PRIME/REVENUE-LEDGER/v1',
    durable_path: DATA_ROOT,
    event_count: events.length,
    journal_count: journals.length,
    ledger_entry_count: entries.length,
    fulfillment_count: readLines(FULFILLMENT_FILE).length,
    ledger_balance_check_minor: balance,
    balanced: balance === 0,
    accounts: ACCOUNTS
  };
}

module.exports = { ACCOUNTS, recordEvent, recordPayment, recordFulfillment, createFulfillment, eventAlreadyProcessed, health };
