const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const INPUT = path.join(ROOT, 'opportunities');
const OUT = path.join(ROOT, 'compiled', 'opportunities');
const REPORT = path.join(OUT, 'ECONOMIC_GAUNTLET.json');
const HUMAN = path.join(OUT, 'ECONOMIC_GAUNTLET.md');

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
function num(v, fallback = 0) { const n = Number(v); return Number.isFinite(n) ? n : fallback; }
function hash(s) { return crypto.createHash('sha256').update(s, 'utf8').digest('hex'); }

function loadCandidates() {
  return fs.readdirSync(INPUT)
    .filter(f => f.toLowerCase().endsWith('.json') && f !== 'opportunity-schema.json')
    .map(f => {
      const p = path.join(INPUT, f);
      return { file: f, data: JSON.parse(fs.readFileSync(p, 'utf8')) };
    });
}

function score(o) {
  const evidence = num(o.evidence_score, 0);
  const evidenceReady = Array.isArray(o.evidence_required) && o.evidence_required.length > 0;
  const cost = num(o.test_cost_nzd, 0);
  const upside = num(o.upside_nzd, 0);
  const risk = clamp(num(o.risk_score, 5), 0, 10);
  const speed = clamp(num(o.speed_score, 5), 0, 10);
  const isolation = o.silo === 'MTG' || o.silo === 'INVERSE_SHOPPING' || o.silo === 'BILLBOARD' || o.silo === 'ELOM' ? 10 : 0;
  const roi = cost <= 0 ? 10 : clamp((upside / cost) / 10, 0, 10);
  const total = (evidence * 0.30) + (roi * 0.25) + (speed * 0.20) + ((10 - risk) * 0.15) + (isolation * 0.10);
  return {
    evidence,
    roi,
    speed,
    risk,
    silo_alignment: isolation,
    total: Number(total.toFixed(2)),
    evidence_ready: evidenceReady
  };
}

function verdict(s) {
  if (!s.evidence_ready) return 'NEEDS_EVIDENCE';
  if (s.total >= 7.0 && s.evidence >= 6.0 && s.risk <= 6) return 'PASS';
  if (s.risk >= 8) return 'QUARANTINE';
  return 'FAIL';
}

function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const candidates = loadCandidates();
  const results = candidates.map(({ file, data }) => {
    const scoring = score(data);
    return {
      opportunity_id: data.opportunity_id,
      file,
      silo: data.silo,
      title: data.title,
      hypothesis: data.hypothesis,
      channels: data.channels || [],
      buyer: data.buyer,
      offer: data.offer,
      price_nzd: num(data.price_nzd),
      test_cost_nzd: num(data.test_cost_nzd),
      upside_nzd: num(data.upside_nzd),
      smallest_test: data.smallest_test,
      evidence_required: data.evidence_required || [],
      proof_required: data.proof_required || [],
      scoring,
      verdict: verdict(scoring),
      public_action: data.public_action || 'APPROVAL_REQUIRED'
    };
  }).sort((a, b) => b.scoring.total - a.scoring.total);

  const payload = {
    schema_version: '1.0',
    generated_utc: new Date().toISOString(),
    compiler: 'EconomicOpportunityCompiler',
    claim_boundary: 'RANKING_ONLY_NO_REVENUE_CLAIM',
    candidate_count: results.length,
    results,
    recommended_next: results.find(r => r.verdict === 'PASS') || results.find(r => r.verdict === 'NEEDS_EVIDENCE') || null
  };
  payload.integrity_sha256 = hash(JSON.stringify(payload));
  fs.writeFileSync(REPORT, JSON.stringify(payload, null, 2) + '\n', 'utf8');

  const lines = ['# ECONOMIC GAUNTLET', '', `Generated: ${payload.generated_utc}`, '', '| Rank | Opportunity | Score | Verdict | Test | Upside |', '|---:|---|---:|---|---:|---:|'];
  results.forEach((r, i) => lines.push(`| ${i + 1} | ${r.title} | ${r.scoring.total} | ${r.verdict} | NZ$${r.test_cost_nzd} | NZ$${r.upside_nzd} |`));
  lines.push('', '## Boundary', '', 'This report ranks hypotheses. It does not prove demand, sales, or revenue. A PASS only means the candidate meets the local scoring gate and has declared evidence requirements.', '', `Integrity SHA-256: ${payload.integrity_sha256}`);
  fs.writeFileSync(HUMAN, lines.join('\n') + '\n', 'utf8');
  console.log(JSON.stringify({ status: 'PASS', report: REPORT, human_report: HUMAN, candidates: results.length, recommended_next: payload.recommended_next && payload.recommended_next.opportunity_id }, null, 2));
}

main();
