'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const QRCode = require('qrcode');
const ledger = require('../runtime/Ledger');
const ROOT = path.join(__dirname, '..');
const CAMPAIGN = path.join(ROOT, 'distribution', 'campaigns', 'D-001.json');
const STATE = path.join(ROOT, 'distribution', 'state', 'D-001.json');
const ASSETS = path.join(ROOT, 'distribution', 'assets');
function read(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function write(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', 'utf8'); }
function hash(v) { return crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex'); }
function loadCampaign() { return read(CAMPAIGN); }
function prepare() {
  const c = loadCampaign();
  const state = { schema_version: 'BEC-DISTRIBUTION-STATE-1.0', campaign_id: c.campaign_id, status: 'AWAITING_APPROVAL', prepared_at: new Date().toISOString(), public_action_allowed: false, approved_at: null, executed_at: null, assets: [], external_actions: [] };
  state.state_hash = 'sha256:' + hash(state);
  write(STATE, state);
  ledger.appendEvent({ graph_id: 'BEC-DISTRIBUTION', branch_id: c.campaign_id, node_id: 'beck-prepare', event_type: 'CAMPAIGN_PREPARED', silo: c.silo, inputs_hash: c.spec_hash, payload: { campaign_id: c.campaign_id, approval_required: true, public_action_allowed: false } });
  return state;
}
function approve(actor) {
  const c = loadCampaign();
  const state = fs.existsSync(STATE) ? read(STATE) : prepare();
  if (state.status !== 'AWAITING_APPROVAL') throw new Error('Campaign is not awaiting approval');
  if (!actor || !String(actor).trim()) throw new Error('Explicit approver identity is required');
  state.status = 'APPROVED'; state.approved_at = new Date().toISOString(); state.approved_by = String(actor).trim(); state.public_action_allowed = true; state.state_hash = 'sha256:' + hash(state); write(STATE, state);
  ledger.appendEvent({ graph_id: 'BEC-DISTRIBUTION', branch_id: c.campaign_id, node_id: 'approval-gate', event_type: 'CAMPAIGN_APPROVED', silo: c.silo, inputs_hash: c.spec_hash, payload: { campaign_id: c.campaign_id, approved_by: state.approved_by, public_action_allowed: true } });
  return state;
}
async function execute() {
  const c = loadCampaign();
  const state = fs.existsSync(STATE) ? read(STATE) : prepare();
  if (state.status !== 'APPROVED' || state.public_action_allowed !== true) throw new Error('HARD GATE: campaign must be explicitly APPROVED before execution');
  fs.mkdirSync(ASSETS, { recursive: true });
  const trackedUrl = c.doorway.template.replace('{source}', 'direct_outreach').replace('{medium}', 'direct');
  const qrPath = path.join(ASSETS, 'D-001-canonical.svg');
  await QRCode.toFile(qrPath, trackedUrl, { type: 'svg', errorCorrectionLevel: 'M', margin: 2, width: 800 });
  const handoff = { campaign_id: c.campaign_id, tracked_url: trackedUrl, qr_asset: qrPath, external_actions: [{ channel: 'direct_outreach', target_count: c.audience.max_targets, mode: 'STAGED_NOT_SENT', approval_required: true }], message_template: 'I built a finite digital billboard where a founding tile stays visible until 3000. The founding tile is NZ$50. If you want one, the details are here: ' + trackedUrl };
  write(path.join(ASSETS, 'D-001-handoff.json'), handoff);
  state.status = 'INTERNAL_EXECUTED'; state.executed_at = new Date().toISOString(); state.public_action_allowed = false; state.assets = ['D-001-canonical.svg', 'D-001-handoff.json']; state.external_actions = ['STAGED_NOT_SENT']; state.state_hash = 'sha256:' + hash(state); write(STATE, state);
  ledger.appendEvent({ graph_id: 'BEC-DISTRIBUTION', branch_id: c.campaign_id, node_id: 'beck-execute', event_type: 'EXECUTION_STAGED', silo: c.silo, inputs_hash: c.spec_hash, payload: { campaign_id: c.campaign_id, tracked_url: trackedUrl, external_actions: 'STAGED_NOT_SENT', human_approval_used: true }, result: 'PASS' });
  return { state, handoff };
}
if (require.main === module) {
  const [command, actor] = process.argv.slice(2);
  (async () => { if (command === 'prepare') return console.log(JSON.stringify(prepare(), null, 2)); if (command === 'approve') return console.log(JSON.stringify(approve(actor || 'HUMAN_APPROVER'), null, 2)); if (command === 'execute') return console.log(JSON.stringify(await execute(), null, 2)); throw new Error('Usage: node distribution/BECK-Executor.js prepare|approve <actor>|execute'); })().catch(error => { console.error(error.message); process.exitCode = 1; });
}
module.exports = { prepare, approve, execute };
