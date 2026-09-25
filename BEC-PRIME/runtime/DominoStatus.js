'use strict';

const fs = require('fs');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function buildStatus(reconciliation) {
  const offers = Array.isArray(reconciliation.offers) ? reconciliation.offers : [];
  const settled = offers.filter(x => x.state === 'SETTLED_PENDING_FULFILLMENT');
  const pending = offers.filter(x => x.state === 'PAYMENT_PENDING');
  const contradicted = offers.filter(x => x.state === 'CONTRADICTED');

  let currentDomino;
  let nextHumanAction;
  let blocker;

  if (settled.length) {
    currentDomino = 'SETTLED PAYMENT DETECTED: move the matched offer through fulfillment and independent verification.';
    nextHumanAction = 'Review and authorize fulfillment for the settled offer(s): ' + settled.map(x => x.offer_id).join(', ');
    blocker = 'Fulfillment and independent proof are not yet established by Stripe reconciliation alone.';
  } else {
    currentDomino = 'EXTERNAL EFFECT NOT YET PROVEN: expose one approved offer to a real buyer through an authorized channel.';
    nextHumanAction = 'Dispatch the approved Discord acquisition workflow for CMD-DIAG-29 using an authorized machine credential.';
    blocker = 'No settled payment is currently established for an approved offer.';
  }

  return {
    schema_version: 'DREAMLEDGER/DOMINO-STATUS/v1',
    generated_at: new Date().toISOString(),
    current_domino: currentDomino,
    next_human_action: nextHumanAction,
    blocker,
    scoreboard: {
      settled_offer_count: settled.length,
      payment_pending_offer_count: pending.length,
      contradicted_offer_count: contradicted.length,
      business_truth_claim: 'NOT_CLAIMED'
    },
    evidence_boundary: {
      settlement_authority: 'Stripe live evidence',
      fulfillment: 'UNVERIFIED',
      independent_proof: 'UNVERIFIED',
      verified_revenue: 'UNVERIFIED'
    }
  };
}

if (require.main === module) {
  const file = process.argv[2] || 'proof/commerce/latest-approved-offer-reconciliation.json';
  if (!fs.existsSync(file)) {
    console.error('Missing reconciliation proof: ' + file);
    process.exit(2);
  }
  console.log(JSON.stringify(buildStatus(readJson(file)), null, 2));
}

module.exports = { buildStatus };
