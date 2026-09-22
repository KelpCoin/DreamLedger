'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const AUTONOMY = __dirname;
const STATE = path.join(AUTONOMY, 'SUPERINTENDENT-STATE.json');
const PROOF_DIR = path.join(AUTONOMY, 'PROOFS');
const ESCALATION_DIR = path.join(AUTONOMY, 'QUEUE', 'ESCALATIONS');
const QUEUE_FILE = path.join(AUTONOMY, 'MISSION-QUEUE.json');
const POLICY = path.join(AUTONOMY, 'TOOL-POLICY.json');

const DEFAULT_CAPITAL_NZD = Number(process.env.BEC_AVAILABLE_CAPITAL_NZD || 0);
const RESERVE_NZD = Number(process.env.BEC_RESERVE_NZD || DEFAULT_CAPITAL_NZD);
const now = () => new Date().toISOString();
const sha256 = value => crypto.createHash('sha256').update(value, 'utf8').digest('hex');

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

const policy = readJson(POLICY, { human_gate_actions: [], forbidden_actions: [] });
const queue = readJson(QUEUE_FILE, { missions: [] });

function wsjf(m) {
  const cod = Number(m.business_value || 0) + Number(m.time_criticality || 0) + Number(m.risk_reduction || 0);
  return cod / Math.max(Number(m.job_size || 1), 1);
}

function authority(m) {
  if ((policy.forbidden_actions || []).includes(m.action)) return 'CANNOT_EXECUTE';
  if ((policy.human_gate_actions || []).includes(m.action)) return 'MUST_ESCALATE';
  if (m.public === true || m.external_contact === true || m.spending_nzd > 0 || m.merge_main === true) return 'MUST_ESCALATE';
  return 'CAN_EXECUTE';
}

function buildState() {
  const candidates = (queue.missions || []).map(m => ({
    ...m,
    wsjf_score: Number(wsjf(m).toFixed(4)),
    authority: authority(m)
  })).filter(m => m.enabled !== false);

  candidates.sort((a,b) => b.wsjf_score - a.wsjf_score);
  const selected = candidates[0] || null;
  const capital = {
    available_capital_nzd: DEFAULT_CAPITAL_NZD,
    reserved_capital_nzd: Math.max(RESERVE_NZD, 0),
    reinvestable_capital_nzd: Math.max(DEFAULT_CAPITAL_NZD - Math.max(RESERVE_NZD, 0), 0)
  };

  let allocation = { status: 'CAPITAL_BLOCKED', selected_allocation: 'RETAIN', reason: 'No capital is safely reinvestable.' };
  if (selected && Number(selected.spending_nzd || 0) > capital.reinvestable_capital_nzd) {
    allocation.reason = 'Mission spend exceeds reinvestable capital.';
  } else if (selected && Number(selected.spending_nzd || 0) > 0) {
    allocation = { status: 'ESCALATE', selected_allocation: selected.mission_id, reason: 'Spend requires human approval.' };
  } else if (selected) {
    allocation = { status: 'NO_SPEND', selected_allocation: selected.mission_id, reason: 'Selected mission has zero monetary cost.' };
  }

  const state = {
    schema: 'dreamledger/economic-superintendent/v1',
    observed_at: now(),
    economic_state: {
      verified_revenue_nzd: 0,
      verified_payments: 0,
      independent_buyers: 0,
      available_capital_nzd: capital.available_capital_nzd,
      reserved_capital_nzd: capital.reserved_capital_nzd,
      reinvestable_capital_nzd: capital.reinvestable_capital_nzd,
      revenue_source_status: 'CONFIGURED_INPUT_ONLY',
      note: 'This runner never manufactures revenue. Production settlement truth must come from the external payment verifier.'
    },
    candidate_count: candidates.length,
    ranked_missions: candidates,
    next_mission: selected,
    capital_allocator: allocation,
    execution: selected ? (selected.authority === 'CAN_EXECUTE' ? 'DISPATCH_ELIGIBLE' : selected.authority) : 'NO_MISSION',
    evidence_required: selected?.evidence_required || null
  };

  if (selected && selected.authority === 'MUST_ESCALATE') {
    const escalation = {
      schema: 'dreamledger/mission-escalation/v1',
      created_at: now(),
      mission_id: selected.mission_id,
      action: selected.action,
      authority: selected.authority,
      reason: selected.escalation_reason || 'Constitutional human-authority boundary.',
      prepared_action: selected.prepared_action || null,
      approval_required: true
    };
    const id = sha256(JSON.stringify(escalation)).slice(0, 16);
    writeJson(path.join(ESCALATION_DIR, id + '.json'), escalation);
    state.escalation_file = path.join('QUEUE', 'ESCALATIONS', id + '.json');
  }

  return state;
}

function main() {
  const state = buildState();
  writeJson(STATE, state);
  const proof = {
    schema: 'dreamledger/economic-superintendent-proof/v1',
    status: 'PASS',
    observed_at: state.observed_at,
    selected_mission_id: state.next_mission?.mission_id || null,
    selected_authority: state.next_mission?.authority || null,
    wsjf_score: state.next_mission?.wsjf_score || null,
    capital_status: state.capital_allocator.status,
    revenue_truth: state.economic_state.verified_revenue_nzd,
    execution_performed: false,
    reason: 'V1 selects and routes; it does not perform public, spending, payment-rail, merge, or external-contact actions.'
  };
  writeJson(path.join(PROOF_DIR, 'SUPERINTENDENT-LATEST.json'), proof);
  console.log(JSON.stringify(state, null, 2));
}

if (require.main === module) main();
module.exports = { buildState, wsjf, authority };
