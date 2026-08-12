'use strict';

const crypto = require('crypto');

function scoreOpportunity(input) {
  const p = input.product || input;
  const price = Number(p.price || 0);
  const inventory = Number(p.inventory || 0);
  const approved = p.commercial_truth?.approval_required === false || p.approval_required === false;
  const published = p.status === 'published';
  const checkout = p.checkout_available !== false;
  const paymentPath = Boolean(p.checkout || p.payment_adapter || p.checkout_route);
  const checks = {
    published,
    inventory_positive: inventory > 0,
    payment_path: paymentPath,
    approved,
    checkout_available: checkout,
    price_positive: price > 0
  };
  const passed = Object.values(checks).every(Boolean);
  const score = Object.values(checks).filter(Boolean).length * 15 + (Math.min(inventory, 10) * 1);
  const opportunity_id = `OPP-${crypto.createHash('sha256').update(JSON.stringify(p)).digest('hex').slice(0, 16).toUpperCase()}`;
  return {
    opportunity_id,
    status: passed ? 'CANDIDATE' : 'KILLED',
    score,
    payment_path_within_48h: passed,
    checks,
    kill_condition: passed ? 'No paid event within 48h of approved exposure.' : 'Missing a deterministic payment path, approval, inventory, publication, or valid price.',
    source: p.id || null
  };
}

function run(products = []) {
  return products.map(product => scoreOpportunity({ product })).sort((a, b) => b.score - a.score);
}

module.exports = { scoreOpportunity, run };
