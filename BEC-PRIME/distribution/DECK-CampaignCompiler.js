'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'distribution', 'campaigns');
const OFFER_FILE = path.join(ROOT, 'catalog', 'products', 'DREAMLEDGER-BILLBOARD-FOUNDING-001.json');
const CONFIG_FILE = path.join(ROOT, 'distribution', 'config.json');
function hash(v) { return crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex'); }
function compile() {
  const offer = JSON.parse(fs.readFileSync(OFFER_FILE, 'utf8'));
  const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  const campaign = {
    schema_version: 'BEC-CAMPAIGN-SPEC-1.0',
    campaign_id: 'D-001',
    status: 'DRAFT',
    created_by: 'DECK',
    created_at: new Date().toISOString(),
    silo: 'SILO_DREAMLEDGER',
    offer: { offer_id: offer.id, name: offer.name, price_nzd: Number(offer.price) / 100 },
    objective: { metric: 'PAYMENT_RECEIVED', target: 1, amount_nzd: 50 },
    audience: { description: 'qualified creators and small businesses', max_targets: 10 },
    channels: [{ type: 'direct_outreach', mode: 'PREPARE_ONLY', external_action_requires_approval: true }],
    doorway: {
      canonical: cfg.canonical_url,
      campaign_id: 'D-001',
      template: cfg.canonical_url + '?utm_source={source}&utm_medium={medium}&utm_campaign=D-001&experiment_id=EXP-D001&offer_id=' + encodeURIComponent(offer.id)
    },
    qr: { asset_id: cfg.doorway_id, canonical: cfg.canonical_url, placement_variants_allowed: true },
    success_criteria: { min_payments: 1, payment_amount_nzd: 50 },
    kill_condition: { max_qualified_targets: 10, max_human_minutes: 15 },
    approval: { required: true, status: 'PENDING', public_action_allowed: false },
    human_time_budget_minutes: 15,
    evidence_required: ['campaign_spec_hash', 'approval_event', 'execution_event', 'payment_proof_or_zero_payment_result']
  };
  campaign.spec_hash = 'sha256:' + hash(campaign);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const out = path.join(OUT_DIR, 'D-001.json');
  fs.writeFileSync(out, JSON.stringify(campaign, null, 2) + '\n', { encoding: 'utf8' });
  return campaign;
}
if (require.main === module) console.log(JSON.stringify(compile(), null, 2));
module.exports = { compile };
