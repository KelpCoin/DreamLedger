'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ledger = require('../runtime/Ledger');

const ROOT = path.join(__dirname, '..');
const CAMPAIGN = path.join(ROOT, 'distribution', 'campaigns', 'D-001.json');

function read(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function hash(v) { return crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex'); }

function evaluate(input = {}) {
  const campaign = read(CAMPAIGN);
  const payments = Number(input.verified_payments || 0);
  const qualified = Number(input.qualified_targets || 0);
  const minutes = Number(input.human_minutes || 0);
  const responses = Number(input.responses || 0);
  const contradictions = Number(input.verification_contradictions || 0);

  let decision = 'CONTINUE';
  const reasons = [];
  if (contradictions > 0) { decision = 'KILL'; reasons.push('verification_contradiction'); }
  else if (payments >= Number(campaign.success_criteria.min_payments)) { decision = 'PROMOTE'; reasons.push('verified_payment_target_met'); }
  else if (qualified >= Number(campaign.kill_condition.max_qualified_targets) && responses === 0) { decision = 'KILL'; reasons.push('no_response_at_target_limit'); }
  else if (minutes >= Number(campaign.kill_condition.max_human_minutes)) { decision = 'KILL'; reasons.push('human_time_budget_exhausted'); }
  else if (responses > 0) { decision = 'FOLLOW_UP'; reasons.push('external_response_exists'); }

  const result = {
    schema_version: 'BEC-DISTRIBUTION-FEEDBACK-1.0',
    campaign_id: campaign.campaign_id,
    decision,
    reasons,
    metrics: { payments, qualified, minutes, responses, contradictions },
    evidence_status: payments > 0 ? 'VERIFIED_PAYMENT_REQUIRED_FOR_PROMOTION' : 'NO_VERIFIED_PAYMENT',
    generated_at: new Date().toISOString()
  };
  result.result_hash = 'sha256:' + hash(result);
  ledger.appendEventIdempotent({
    event_id: 'distribution_feedback_' + campaign.campaign_id + '_' + hash(input).slice(0, 16),
    graph_id: 'BEC-DISTRIBUTION',
    branch_id: campaign.campaign_id,
    node_id: 'feedback',
    event_type: 'DISTRIBUTION_FEEDBACK',
    silo: campaign.silo,
    payload: result,
    result: decision === 'KILL' ? 'FAIL' : 'PASS'
  });
  return result;
}

if (require.main === module) {
  const input = process.argv[2] ? JSON.parse(process.argv[2]) : {};
  console.log(JSON.stringify(evaluate(input), null, 2));
}
module.exports = { evaluate };
