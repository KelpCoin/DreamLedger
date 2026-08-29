'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const checks = [];
function check(name, pass, detail) { checks.push({ name, status: pass ? 'PASS' : 'FAIL', detail }); }
function read(rel) { return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')); }
function syntax(rel) { try { execFileSync(process.execPath, ['--check', path.join(ROOT, rel)], { stdio: 'pipe' }); return true; } catch { return false; } }
function main() {
  const cfg = read('distribution/config.json');
  const campaign = read('distribution/campaigns/D-001.json');
  const pkg = read('package.json');
  check('canonical doorway config', cfg.canonical_url === 'https://dreamledger.org/go' && cfg.destination_path === '/billboard', JSON.stringify(cfg));
  check('canonical QR identity', cfg.doorway_id === 'QR-CANONICAL-001', cfg.doorway_id);
  check('approval hard gate', campaign.approval?.required === true && campaign.approval?.public_action_allowed === false && campaign.status === 'DRAFT', JSON.stringify(campaign.approval));
  check('economic target', campaign.objective?.metric === 'PAYMENT_RECEIVED' && campaign.objective?.target === 1 && campaign.objective?.amount_nzd === 50, JSON.stringify(campaign.objective));
  check('human time budget', campaign.human_time_budget_minutes === 15 && campaign.kill_condition?.max_human_minutes === 15, String(campaign.human_time_budget_minutes));
  check('package integration', typeof pkg.scripts['compile:distribution'] === 'string' && typeof pkg.scripts['verify:distribution'] === 'string', 'compile:distribution + verify:distribution');
  check('doorway syntax', syntax('routes/distributionDoorway.js'), 'node --check');
  check('deck syntax', syntax('distribution/DECK-CampaignCompiler.js'), 'node --check');
  check('beck syntax', syntax('distribution/BECK-Executor.js'), 'node --check');
  const failed = checks.filter(x => x.status === 'FAIL');
  const proof = { schema_version: 'BEC-DISTRIBUTION-PROOF-1.0', generated_at: new Date().toISOString(), status: failed.length ? 'FAIL' : 'PASS', checks, claims: { public_action_executed: false, payment_claim: false, first_party_doorway_implemented: true, approval_gate_implemented: true }, proof_note: 'Architecture verification only. No external distribution action is performed by this verifier.' };
  const out = path.join(ROOT, 'distribution', 'proof', 'DISTRIBUTION-VERTICAL-SLICE-PROOF.json');
  fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, JSON.stringify(proof, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify(proof, null, 2));
  if (failed.length) process.exitCode = 1;
}
main();
