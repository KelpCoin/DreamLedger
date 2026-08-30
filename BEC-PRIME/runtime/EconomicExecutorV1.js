'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const court = require('./EconomicCourtV2');
const platformCart = require('../routes/platformCart');

const ROOT = path.join(__dirname, '..');
const PROOF_DIR = path.join(ROOT, 'data', 'proofs');

function executeApprovedCheckout(proposal, approvalToken) {
  const gate = court.executable(proposal, approvalToken);
  if (!gate.executable) throw new Error(`Execution blocked: ${gate.reason}`);
  if (proposal.action !== 'checkout') throw new Error('Only checkout proposals may reach the payment adapter');
  if (!proposal.sku || proposal.amount_minor <= 0 || proposal.currency !== 'NZD') throw new Error('Executable proposal is malformed');
  return platformCart.createProductCheckout(proposal.sku, proposal.silo).then(result => {
    const proof = {
      schema_version: 'BEC-EXECUTOR-1.0',
      execution_id: `EXEC-${crypto.randomUUID()}`,
      proposal_id: proposal.proposal_id,
      approval_id: approvalToken.approval_id,
      status: 'EXECUTED',
      executed_at: new Date().toISOString(),
      sku: proposal.sku,
      amount_minor: proposal.amount_minor,
      currency: proposal.currency,
      silo: proposal.silo,
      checkout_mode: result.mode || 'unknown',
      checkout_url_issued: Boolean(result.checkout_url),
      payment_settled: false,
      settlement_proof_required: true,
      autonomous_spend: false
    };
    fs.mkdirSync(PROOF_DIR, { recursive: true });
    fs.writeFileSync(path.join(PROOF_DIR, `${proof.execution_id}.json`), JSON.stringify(proof, null, 2) + '\n', 'utf8');
    return { ...result, execution: proof };
  });
}

module.exports = { executeApprovedCheckout };
