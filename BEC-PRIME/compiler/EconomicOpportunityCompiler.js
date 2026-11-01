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

function normalizeSilo(silo) {
  const result=typeof silo==='string' ? silo.toUpperCase().trim().replace(/[\s-]+/g,'_') : '';
  return result || 'UNKNOWN';
}

function score(o) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) o={};
  const silo = normalizeSilo(o.silo);
  const frozen = silo==='AMPLISSA'||silo==='ADULT'||silo==='SILO_ADULT';
  const claimedEvidence = clamp(num(o.evidence_score,0),0,10);
  const evidence = Math.min(claimedEvidence,4);
  const declarations = Array.isArray(o.evidence_required) ? o.evidence_required.filter(x=>typeof x==='string'&&x.trim()) : [];
  const cost = num(o.test_cost_nzd,NaN);
  const upside = num(o.upside_nzd,NaN);
  const costKnown = Number.isFinite(cost)&&cost>=0;
  const costFreeClaimed = costKnown&&cost===0;
  const roi = (costKnown&&cost>0&&Number.isFinite(upside)&&upside>0)
    ? clamp((upside/cost)/10,0,10) : 0;
  const risk=clamp(num(o.risk_score,7),0,10);
  const speed=clamp(num(o.speed_score,3),0,10);
  const total=Number(((evidence*0.40)+(roi*0.10)+(speed*0.20)+((10-risk)*0.30)).toFixed(2));
  return {
    evidence, claimed_evidence:claimedEvidence, evidence_score_is_self_reported:true,
    evidence_declarations_only:declarations.length>0,
    verified_external_buyer:false, verified_settlement:false, verified_fulfillment:false,
    cost_known:costKnown, zero_cost_is_unverified:costFreeClaimed,
    roi, speed, risk, silo_alignment:0, silo, frozen, total,
    evidence_ready:false, release_authorized:false
  };
}

function verdict(s) {
  if(s.frozen)return 'QUARANTINE';
  if(s.silo==='UNKNOWN')return 'QUARANTINE';
  if(s.risk>=8)return 'QUARANTINE';
  return 'NEEDS_EXTERNAL_VERIFICATION';
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
      public_action: 'APPROVAL_REQUIRED',
      requested_public_action: data.public_action || null
    };
  }).sort((a, b) => Number(a.verdict === 'QUARANTINE') - Number(b.verdict === 'QUARANTINE') || b.scoring.total - a.scoring.total);

  const payload = {
    schema_version: '1.0',
    generated_utc: new Date().toISOString(),
    compiler: 'EconomicOpportunityCompiler',
    claim_boundary: 'RANKING_ONLY_NO_REVENUE_CLAIM',
    candidate_count: results.length,
    results,
    recommended_next: results.find(r => r.verdict === 'NEEDS_EXTERNAL_VERIFICATION') || null,
    approval_required: true,
    production_release_allowed: false,
    independent_economic_truth: 'NOT_VERIFIED'
  };
  payload.integrity_sha256 = hash(JSON.stringify(payload));
  fs.writeFileSync(REPORT, JSON.stringify(payload, null, 2) + '\n', 'utf8');

  const lines = ['# ECONOMIC GAUNTLET', '', `Generated: ${payload.generated_utc}`, '', '| Rank | Opportunity | Score | Verdict | Test | Upside |', '|---:|---|---:|---|---:|---:|'];
  results.forEach((r, i) => lines.push(`| ${i + 1} | ${r.title} | ${r.scoring.total} | ${r.verdict} | NZ$${r.test_cost_nzd} | NZ$${r.upside_nzd} |`));
  lines.push('', '## Boundary', '', 'This report ranks hypotheses. It does not prove demand, sales, or revenue. Historical evidence scores are unverified declarations, NZ$0 costs do not prove ROI, and ranking cannot authorize publication, spending, payment or revenue claims.', '', `Integrity SHA-256: ${payload.integrity_sha256}`);
  fs.writeFileSync(HUMAN, lines.join('\n') + '\n', 'utf8');
  console.log(JSON.stringify({ status: 'PASS', report: REPORT, human_report: HUMAN, candidates: results.length, recommended_next: payload.recommended_next && payload.recommended_next.opportunity_id }, null, 2));
}

if (require.main === module) main();
module.exports = { score, verdict, normalizeSilo, main };
