'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const INPUT_DIR = path.join(ROOT, 'opportunities');
const OUTPUT_DIR = path.join(ROOT, 'compiled', 'opportunities');
const REPORT_PATH = path.join(OUTPUT_DIR, 'ECONOMIC_OPPORTUNITY_REPORT.json');
const REPORT_MD_PATH = path.join(OUTPUT_DIR, 'ECONOMIC_OPPORTUNITY_REPORT.md');

function sha256(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function readOpportunities() {
  if (!fs.existsSync(INPUT_DIR)) return [];
  return fs.readdirSync(INPUT_DIR)
    .filter(name => name.toLowerCase().endsWith('.json'))
    .sort()
    .map(name => {
      const file = path.join(INPUT_DIR, name);
      const raw = fs.readFileSync(file, 'utf8');
      const value = JSON.parse(raw);
      return { file: name, hash: sha256(raw), value };
    });
}

function normalise(record) {
  const o = record.value;
  return {
    opportunity_id: String(o.opportunity_id || ''),
    silo: String(o.silo || ''),
    title: String(o.title || ''),
    hypothesis: String(o.hypothesis || ''),
    target_buyer: String(o.target_buyer || ''),
    channel: String(o.channel || ''),
    smallest_test: String(o.smallest_test || ''),
    evidence_required: Array.isArray(o.evidence_required) ? o.evidence_required : [],
    cost_nzd: Number(o.cost_nzd || 0),
    upside_nzd: Number(o.upside_nzd || 0),
    risk: String(o.risk || 'UNKNOWN'),
    reversibility: String(o.reversibility || 'UNKNOWN'),
    execution_steps: Array.isArray(o.execution_steps) ? o.execution_steps : [],
    proof_required: Array.isArray(o.proof_required) ? o.proof_required : [],
    approval_required: o.approval_required !== false,
    public_action: o.public_action === true,
    payment_adapter: String(o.payment_adapter || 'UNSELECTED'),
    kill_condition: String(o.kill_condition || ''),
    source_file: record.file,
    source_sha256: record.hash,
    compiler_state: 'AWAITING_GAUNTLET'
  };
}

function validate(o) {
  const required = ['opportunity_id','silo','title','hypothesis','target_buyer','smallest_test','kill_condition'];
  const missing = required.filter(key => !o[key]);
  if (!o.evidence_required.length) missing.push('evidence_required');
  if (!o.execution_steps.length) missing.push('execution_steps');
  if (!o.proof_required.length) missing.push('proof_required');
  return { status: missing.length ? 'INVALID' : 'VALID', missing };
}

function markdown(items) {
  const lines = [
    '# Economic Opportunity Compiler',
    '',
    'Compiler output only. The compiler creates and normalises opportunities; it does not judge, approve, publish, or declare truth.',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '| ID | Silo | Opportunity | Test | Cost | Upside | Risk | State |',
    '|---|---|---|---|---:|---:|---|---|'
  ];
  for (const item of items) {
    lines.push(`| ${item.opportunity_id} | ${item.silo} | ${item.title.replace(/\|/g, '/')} | ${item.smallest_test.replace(/\|/g, '/')} | NZ$${item.cost_nzd} | NZ$${item.upside_nzd} | ${item.risk} | ${item.compiler_state} |`);
  }
  lines.push('', 'Next machine stage: Truth Oracle evidence checks -> Gauntlet verdict -> Staging -> Biggie approval -> Compiler release.', '');
  return lines.join('\n');
}

function compile() {
  const source = readOpportunities();
  const items = source.map(normalise);
  const validation = items.map(validate);
  const invalid = validation.filter(x => x.status !== 'VALID').length;
  const report = {
    type: 'dreamledger-economic-opportunity-compiler-report',
    schema_version: '1.0',
    generated_at: new Date().toISOString(),
    role_boundary: {
      elohim: 'CREATE_AND_REFINE_ONLY',
      truth_oracle: 'EVIDENCE_ONLY',
      gauntlet: 'JUDGE',
      biggie: 'APPROVE_PUBLIC_OR_HIGH_IMPACT_ACTIONS',
      compiler: 'NORMALISE_AND_PACKAGE_ONLY'
    },
    source_count: source.length,
    valid_count: items.length - invalid,
    invalid_count: invalid,
    opportunities: items.map((item, index) => ({ ...item, validation: validation[index] })),
    public_execution: 'BLOCKED_UNTIL_GAUNTLET_AND_HUMAN_APPROVAL'
  };
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2) + '\n', 'utf8');
  fs.writeFileSync(REPORT_MD_PATH, markdown(report.opportunities) + '\n', 'utf8');
  return report;
}

if (require.main === module) {
  const report = compile();
  console.log(JSON.stringify({
    status: report.invalid_count === 0 ? 'PASS' : 'FAIL',
    source_count: report.source_count,
    valid_count: report.valid_count,
    invalid_count: report.invalid_count,
    report: REPORT_PATH
  }, null, 2));
  process.exit(report.invalid_count === 0 ? 0 : 1);
}

module.exports = { compile, normalise, validate };
