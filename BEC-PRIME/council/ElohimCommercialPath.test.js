'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildCommercialPath } = require('./ElohimCommercialPath');

test('Elohim builds a complete commercial path without sending or charging', () => {
  const path = buildCommercialPath({
    capability: { id: 'CAP-1', name: 'Truth and Proof Engine', commercialization: 'audit' },
    demand: { id: 'GETS-PH26-001', title: 'Kaiawhina Workforce RFP', source_url: 'https://www.gets.govt.nz/HEALTHNZ/ExternalTenderDetails.htm?id=34839722' },
    prospect: { name: 'Example Prospect', basis: 'Relevant prior procurement activity' },
    offer: { name: 'Tender Readiness Snapshot', price_nzd: 49, message: 'Draft', checkout_url: 'https://example.test/pay' },
    fulfillment: { deliverable: 'Evidence-backed tender readiness snapshot', procedure: ['Read source', 'Extract requirements'], evidence_required: ['source copy', 'delivered artifact'] }
  });

  assert.equal(path.state, 'HUMAN_GATE_REQUIRED');
  assert.equal(path.message.send_status, 'NOT_SENT');
  assert.equal(path.gates.public_contact, 'HUMAN_APPROVAL_REQUIRED');
  assert.equal(path.gates.financial_action, 'HUMAN_APPROVAL_REQUIRED');
  assert.equal(path.truth_status, 'UNVERIFIED');
});
