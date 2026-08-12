'use strict';

const fs = require('fs');
const path = require('path');

function resolveTaxLedgerPath(env = process.env) {
  return path.resolve(env.TAX_LEDGER_PATH || path.join(__dirname, '..', 'data', 'tax', 'tax_ledger_2026.csv'));
}

function gstFromInclusiveGross(amountMinor, rate = 0.15) {
  const amount = Number(amountMinor || 0);
  if (!Number.isFinite(amount) || amount < 0) throw new Error('Invalid gross amount');
  if (!Number.isFinite(rate) || rate < 0) throw new Error('Invalid GST rate');
  return Math.round(amount * rate / (1 + rate));
}

function appendTaxLedger(record, env = process.env) {
  const file = resolveTaxLedgerPath(env);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const header = 'date,transaction_id,amount_nzd,gst,asset_id,tax_tag\n';
  if (!fs.existsSync(file)) fs.writeFileSync(file, header, 'utf8');
  const line = [
    record.date,
    record.transaction_id,
    record.amount_nzd,
    record.gst,
    record.asset_id,
    JSON.stringify(record.tax_tag).replace(/"/g, '""')
  ].map(v => `"${String(v ?? '')}"`).join(',') + '\n';
  const existing = fs.readFileSync(file, 'utf8');
  if (existing.split('\n').some(row => row.includes(`"${record.transaction_id}"`))) return { ok: true, idempotent: true, path: file };
  fs.appendFileSync(file, line, 'utf8');
  return { ok: true, idempotent: false, path: file };
}

function buildTaxTag({ amountTotalMinor, currency, productId, silo, env = process.env }) {
  const rate = Number(env.GST_RATE || '0.15');
  const gst = String(currency || '').toLowerCase() === 'nzd' ? gstFromInclusiveGross(amountTotalMinor, rate) : 0;
  return {
    category: 'Digital Product',
    currency: String(currency || '').toLowerCase(),
    gst_rate_configured: rate,
    gst_treatment: 'inclusive_gross_calculation',
    gst_amount_minor: gst,
    business_entity: env.TAX_BUSINESS_ENTITY || 'OPERATOR_CONFIG_REQUIRED',
    registration_status: env.GST_REGISTRATION_STATUS || 'OPERATOR_CONFIG_REQUIRED',
    asset_id: productId || null,
    silo: silo || null,
    compliance_note: 'Accounting tag only. GST registration and tax treatment require operator/accountant verification.'
  };
}

module.exports = { resolveTaxLedgerPath, gstFromInclusiveGross, appendTaxLedger, buildTaxTag };
