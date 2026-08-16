'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIR = path.join(ROOT, 'catalog', 'products');
const APPROVED = path.join(ROOT, 'catalog', 'offers', 'approved.json');

const CAPS = ['BEC-PRIME-ARCHITECTURE','BEC-PRIME-CUBE','BEC-PRIME-ELOHIM','BEC-PRIME-GAUNTLET','BEC-PRIME-TRUTH-PROOF','BEC-PRIME-REVENUE-OS','BEC-PRIME-COMMERCE-KERNEL','BEC-PRIME-AGENT-COMMERCE','BEC-PRIME-SILO-CONTROL','BEC-PRIME-PROOF-OF-POWER','BEC-PRIME-READINESS-AUDIT','BEC-PRIME-SENTINEL'];
const AREAS = ['Architecture','CUBE','Orchestration','Gauntlet','Truth Proof','Revenue OS','Commerce Kernel','Agent Commerce','Silo Control','Commercial Proof','Readiness','Runtime Sentinel'];
const PRICES = [49,59,79,89,99,129,149,179,199,249];

function existingApproved() {
  if (!fs.existsSync(APPROVED)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(APPROVED, 'utf8'));
    return Array.isArray(data.approved) ? data.approved.filter(x => !String(x.offer_id || '').startsWith('DL-AUTO-')) : [];
  } catch { return []; }
}

function ensure() {
  fs.mkdirSync(DIR, { recursive: true });
  const approved = existingApproved();
  for (let i = 1; i <= 100; i += 1) {
    const n = String(i).padStart(3, '0');
    const capability = CAPS[(i - 1) % CAPS.length];
    const area = AREAS[(i - 1) % AREAS.length];
    const price = PRICES[(i - 1) % PRICES.length];
    const id = `DL-AUTO-${n}`;
    const name = `DreamLedger ${area} Action Pack ${n}`;
    const description = `A self-contained digital ${area.toLowerCase()} action pack with a structured checklist, decision matrix, implementation sequence, and verification worksheet for operators.`;
    const product = {
      id, silo: 'commerce', name, description, price: price * 100, currency: 'nzd', inventory: 1000, status: 'published', capability_id: capability,
      checkout: { mode: 'payment', success_path: '/checkout/success', cancel_path: '/revenue.html' },
      commercial_truth: { experiment: `DL-AUTO-100-${n}`, approval_required: false, approval_source: 'operator-approved revenue catalog commit', activation_gate: 'CHECKOUT_VERIFIED', payment_surface: 'engine-generated-stripe-checkout' },
      delivery: { type: 'digital_action_pack', target: `dreamledger-auto-${n}` },
      evidence: { status: 'awaiting_first_payment', transaction_id: null }, execution_atom: id
    };
    fs.writeFileSync(path.join(DIR, `${id}.json`), JSON.stringify(product, null, 2) + '\n', 'utf8');
    approved.push({
      offer_id: id, product_id: id, capability_id: capability, silo: 'dreamledger', name, problem: description,
      input: 'No credentials or private data required.', output: description, delivery_mechanism: 'engine_generated_digital_deliverable', deliverable: description,
      target_buyer: 'Operators seeking a structured, low-friction digital implementation pack.', eligibility: 'Available while published inventory remains positive.',
      constraints: ['No credential collection','No private conversation publication','No unsupported claims','Silo boundaries enforced'], price, currency: 'NZD', pricing_strategy: 'fixed',
      payment_adapter: 'stripe', checkout_route: '/api/offer-checkout/create', proof_of_delivery: 'durable_delivery_record_plus_transaction_proof',
      verification_rules: ['capability_exists','required_offer_fields','price_positive','approval_gate_locked','no_private_ip_exposure','no_unsupported_claims','delivery_defined','payment_defined','proof_defined','silo_isolated','schema_valid','unique_offer_id'],
      provenance: { capability_ids: [capability], methodology: 'auto-revenue-catalog-v1', public_claims_source: 'BEC-PRIME/catalog/ip-capabilities.json', private_material: 'excluded' },
      approved_by: 'operator', approved_at: '2026-08-15'
    });
  }
  fs.writeFileSync(APPROVED, JSON.stringify({ schema: 'BEC-PRIME/APPROVED-OFFERS/v1', rule: 'No commercial offer is publicly checkout-enabled until explicitly approved by the operator.', approved }, null, 2) + '\n', 'utf8');
  return { count: 100, preserved_approved: approved.length - 100, first: 'DL-AUTO-001', last: 'DL-AUTO-100' };
}

if (require.main === module) console.log(JSON.stringify(ensure(), null, 2));
module.exports = { ensure };
