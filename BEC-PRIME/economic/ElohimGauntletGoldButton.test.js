'use strict';

const assert = require('assert');
const {
  loadOffer,
  demandEvidence,
  buildGoldButton
} = require('./ElohimGauntletGoldButton');

const offer = loadOffer('OFFER-CMD-DIAG-29-NZD');
assert.strictEqual(offer.payment_link_status, 'ACTIVE_LIVEMODE');

const demand = demandEvidence(offer);
assert.ok(['OBSERVED', 'UNKNOWN'].includes(demand.state));

const result = buildGoldButton(offer, {
  button_title: 'Get your Commander Deck Diagnostic'
});

assert.strictEqual(result.offer_id, offer.offer_id);
assert.strictEqual(result.price_nzd, 29);
assert.strictEqual(result.elohim.authority, 'none');
assert.strictEqual(result.gauntlet.authority, 'judge_only');
assert.strictEqual(result.publication.approval_required, true);
assert.strictEqual(result.publication.public_dispatch_performed, false);
assert.strictEqual(result.economic_truth.verified_external_revenue_nzd, 0);

if (demand.state === 'OBSERVED') {
  assert.strictEqual(result.publication.state, 'READY_FOR_HUMAN_APPROVAL');
}

console.log(JSON.stringify({
  status: 'PASS',
  offer_id: result.offer_id,
  demand_state: result.demand.state,
  gauntlet: result.gauntlet.verdict,
  publication: result.publication.state,
  public_dispatch_performed: result.publication.public_dispatch_performed,
  verified_external_revenue_nzd: result.economic_truth.verified_external_revenue_nzd
}, null, 2));
