'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const COMPILED = path.join(ROOT, 'compiled', 'opportunities', 'ECONOMIC_OPPORTUNITY_REPORT.json');
const EVIDENCE = path.join(ROOT, 'evidence', 'opportunity-evidence.json');
const OUT_DIR = path.join(ROOT, 'compiled', 'opportunities');
const OUT = path.join(OUT_DIR, 'ECONOMIC_GAUNTLET_REPORT.json');

function sha256(text) { return crypto.createHash('sha256').update(text, 'utf8').digest('hex'); }
function loadEvidence() {
  if (!fs.existsSync(EVIDENCE)) return { evidence: {} };
  return JSON.parse(fs.readFileSync(EVIDENCE, 'utf8'));
}
function verdictFor(o, evidence) {
  const e = evidence[o.opportunity_id];
  if (!e) return { verdict: 'NEEDS_EVIDENCE', reason: 'No evidence packet exists for this opportunity.' };
  if (e.status === 'CONTRADICTED') return { verdict: 'FAIL', reason: 'Evidence packet explicitly contradicts the opportunity hypothesis.' };
  if (e.status !== 'VERIFIED') return { verdict: 'NEEDS_EVIDENCE', reason: `Evidence status is ${e.status || 'UNVERIFIED'}.` };
  if (Number(o.cost_nzd) > Number(e.test_budget_nzd || o.cost_nzd)) return { verdict: 'FAIL', reason: 'Test cost exceeds evidence packet budget.' };
  if (!e.smallest_test_proven) return { verdict: 'NEEDS_EVIDENCE', reason: 'Smallest test has not been proven feasible.' };
  return { verdict: 'PASS', reason: 'Evidence packet satisfies the configured opportunity gate.' };
}
function run() {
  if (!fs.existsSync(COMPILED)) throw new Error('Missing compiled opportunity report. Run npm run compile:opportunities first.');
  const compiled = JSON.parse(fs.readFileSync(COMPILED, 'utf8'));
  const evidence = loadEvidence();
  const results = compiled.opportunities.map(o => ({
    opportunity_id: o.opportunity_id,
    silo: o.silo,
    title: o.title,
    cost_nzd: o.cost_nzd,
    upside_nzd: o.upside_nzd,
    ...verdictFor(o, evidence.evidence || {})
  }));
  const report = {
    type: 'dreamledger-economic-gauntlet-report', schema_version: '1.0', generated_at: new Date().toISOString(),
    judge: 'GAUNTLET',
    role_boundary: { compiler: 'DOES_NOT_JUDGE', truth_oracle: 'SUPPLIES_EVIDENCE_STATUS', gauntlet: 'JUDGES' },
    source_hash: sha256(fs.readFileSync(COMPILED, 'utf8')),
    evidence_source: fs.existsSync(EVIDENCE) ? EVIDENCE : 'NONE',
    results,
    public_execution: results.some(x => x.verdict === 'PASS') ? 'BLOCKED_UNTIL_BIGGIE_APPROVAL' : 'BLOCKED_NO_PASS'
  };
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2) + '\n', 'utf8');
  return report;
}
if (require.main === module) {
  const r = run();
  console.log(JSON.stringify({ status: 'PASS', results: r.results, report: OUT }, null, 2));
}
module.exports = { run, verdictFor };
