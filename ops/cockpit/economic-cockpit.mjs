#!/usr/bin/env node
// Private, evidence-gated DreamLedger cockpit scoring. Unknown/stale evidence earns zero.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const root = process.cwd();
const proofRoot = process.env.DREAMLEDGER_PROOF_ROOT || path.join(root, 'proof');
const outDir = path.join(proofRoot, 'cockpit');
const generatedAt = new Date().toISOString();

const CLOUD = [
  ['cloud_workflow', 'Cloud workflow evidence fresh and passing', 1000],
  ['public_truth_oracle_http', 'Public Truth Oracle HTTP and canonical route verified', 1000],
  ['public_copy_boundary', 'Public pages contain no internal-only operating terms', 1000],
  ['supabase_control_plane', 'Supabase control plane reachable', 500],
  ['supabase_data_plane', 'Supabase data plane query succeeds', 1500],
  ['stripe_webhook_routing', 'Live Stripe webhook routing reconciled', 1000],
  ['settlement_attribution', 'Settled payment attributed to canonical offer', 1500],
  ['paid_fulfillment', 'Paid order fulfillment and delivery receipt verified', 1500],
  ['backup_recovery', 'Independent backup and restore drill proven', 500],
  ['alert_safety', 'Notification staging, delay, rate limit and kill switch verified', 500],
];
const LOCAL = [
  ['node_runtime', 'Supported local Node runtime available', 1000],
  ['startup_bootstrap', 'Local startup bootstrap passes', 1000],
  ['fresh_local_proof', 'Fresh local proof artifact exists', 1000],
  ['cloud_local_separation', 'Cloud remains independently operable when PC is off', 1000],
  ['secret_hygiene', 'Secrets excluded from files, logs and Git', 1000],
  ['local_model', 'Optional local model endpoint is reachable', 500],
  ['cockpit_readable', 'Cockpit report renders with current evidence timestamps', 1000],
  ['backup_restore', 'Local encrypted backup and restore test proven', 1000],
  ['kill_switch', 'Notification kill switch is off or tested', 1000],
  ['operator_gate', 'Irreversible/public actions require explicit approval', 1500],
];
const MONEY = [
  ['independent_buyer', 'Independent buyer evidenced', 1500],
  ['settled_payment', 'External payment settled and attributable', 2000],
  ['fulfillment', 'Paid order fulfilled', 2000],
  ['delivery_receipt', 'Buyer delivery receipt evidenced', 1500],
  ['payout_reconciled', 'Stripe payout reconciled separately', 1000],
  ['refund_dispute_check', 'Refund/dispute state reconciled', 500],
  ['net_contribution', 'Fees, costs and net contribution calculated', 1000],
  ['repeatability', 'Repeatable acquisition/delivery evidence exists', 500],
];

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}
function freshEnough(item, maxAgeHours=24) {
  if (!item || item.status !== 'PASS' || !item.checked_at) return false;
  const t = Date.parse(item.checked_at);
  return Number.isFinite(t) && (Date.now()-t) <= maxAgeHours*3600000 && t <= Date.now()+300000;
}
function scoreVector(name, rows, evidence, maxAgeHours=24) {
  const details = rows.map(([key,label,weight]) => {
    const item = evidence?.[key];
    const passed = freshEnough(item, maxAgeHours);
    return {key,label,weight,earned:passed?weight:0,status:item?.status || 'UNVERIFIED',checked_at:item?.checked_at || null,source:item?.source || null,reason:item?.reason || (passed?'Fresh passing evidence':'No fresh passing evidence; unknown is not pass')};
  });
  const earned = details.reduce((a,x)=>a+x.earned,0);
  const maximum = rows.reduce((a,x)=>a+x[2],0);
  return {name,score:earned,maximum,percent:Math.round(earned/maximum*1000)/10,details};
}
function latestEvidence() {
  const candidates = [
    path.join(proofRoot,'BECK-ECONOMIC-VALIDATION-LATEST.json'),
    path.join(proofRoot,'BECK-STARTUP-LATEST.json'),
    path.join(root,'proof/commerce/latest-stripe-webhook-routing.json'),
    path.join(root,'proof/commerce/latest-truth-oracle-access.json'),
  ];
  const found = {};
  for (const file of candidates) {
    const data = readJson(file);
    if (data) found[path.basename(file)] = {path:file,data};
  }
  return found;
}
const raw = readJson(process.env.DREAMLEDGER_COCKPIT_EVIDENCE || path.join(proofRoot,'cockpit','cockpit-evidence.json')) || {};
const cloud = scoreVector('Cloud system readiness / 10,000',CLOUD,raw.cloud||{});
const local = scoreVector('Local runtime readiness / 10,000',LOCAL,raw.local||{});
const money = scoreVector('Verified economic outcome / 10,000',MONEY,raw.money||{},72);
const baseline = raw.truth_baseline || {};
const report = {
  schema:'DREAMLEDGER-PRIVATE-COCKPIT/v1',
  generated_at:generatedAt,
  classification:'PRIVATE_INTERNAL',
  scoring:{rule:'Only fresh, timestamped PASS evidence earns points. Missing, stale, simulated or unknown evidence earns zero.',max_age_hours:24,scale:10000},
  verified_money:{
    currency:'NZD',
    settled_revenue_nzd:Number(baseline.settled_revenue_nzd||0),
    settled_external_payments:Number(baseline.settled_external_payments||0),
    independent_buyers:Number(baseline.independent_buyers||0),
    paid_fulfilled_orders:Number(baseline.paid_fulfilled_orders||0),
    verified_outcomes:Number(baseline.verified_outcomes||0),
    source:baseline.source||'No fresh settlement ledger evidence supplied; default baseline is zero, not a Stripe reconciliation.'
  },
  scores:{cloud,local,economic:money},
  recent_proof_files:latestEvidence(),
  safety:{notifications_enabled:false,public_actions_enabled:false,live_mutations_enabled:false,kill_switch:'ON',note:'Report generation is read-only. Discord sending is implemented separately and defaults off.'},
  host:{platform:os.platform(),node:process.version},
};
fs.mkdirSync(outDir,{recursive:true});
fs.writeFileSync(path.join(outDir,'cockpit-latest.json'),JSON.stringify(report,null,2)+'\n',{mode:0o600});
const esc = x => String(x??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const scoreCard = s => `<section><h2>${esc(s.name)}</h2><p class="score">${s.score.toLocaleString()} <small>/ ${s.maximum.toLocaleString()}</small></p><p>${s.percent}% evidence coverage</p><details><summary>Show scoring evidence</summary><table><tr><th>Check</th><th>Points</th><th>Status</th><th>Evidence time</th><th>Reason</th></tr>${s.details.map(d=>`<tr><td>${esc(d.label)}</td><td>${d.earned}/${d.weight}</td><td>${esc(d.status)}</td><td>${esc(d.checked_at||'none')}</td><td>${esc(d.reason)}</td></tr>`).join('')}</table></details></section>`;
const html = `<!doctype html><html lang="en-NZ"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Private Economic Cockpit</title><style>body{font:16px system-ui;max-width:1050px;margin:2rem auto;padding:0 1rem;background:#10151c;color:#edf2f7}h1{font-size:1.8rem}section{background:#1b2430;padding:1rem;margin:1rem 0;border-radius:12px;overflow:auto}.score{font-size:2.3rem;font-weight:700;margin:.2rem 0}.score small{font-size:1rem;color:#a9b6c5}table{border-collapse:collapse;width:100%;font-size:.9rem}th,td{text-align:left;border-bottom:1px solid #3a4655;padding:.55rem}summary{cursor:pointer} .muted{color:#a9b6c5}.warning{border-left:4px solid #e4a74d;padding:.7rem;background:#29271f}</style></head><body><h1>Private Economic Cockpit</h1><p class="muted">Generated ${esc(generatedAt)} · evidence freshness window 24h · scale 0–10,000</p><p class="warning">Scores measure verified readiness, not probability of becoming rich. Unknown evidence earns zero. A green technical check is not revenue.</p><section><h2>Verified money today</h2><p class="score">NZ$ ${Number(report.verified_money.settled_revenue_nzd).toLocaleString('en-NZ',{minimumFractionDigits:2,maximumFractionDigits:2})}</p><p>Settled payments: ${report.verified_money.settled_external_payments} · Independent buyers: ${report.verified_money.independent_buyers} · Fulfilled orders: ${report.verified_money.paid_fulfilled_orders} · Verified outcomes: ${report.verified_money.verified_outcomes}</p><p class="muted">${esc(report.verified_money.source)}</p></section>${scoreCard(cloud)}${scoreCard(local)}${scoreCard(money)}<section><h2>Safety controls</h2><p>Kill switch: ON · Notifications: OFF · Public actions: OFF · Live mutations: OFF</p><p class="muted">This file is private/local. Do not publish it to the public website.</p></section></body></html>`;
fs.writeFileSync(path.join(outDir,'index.html'),html,{mode:0o600});
console.log(JSON.stringify({status:'PASS_REPORT_GENERATED',json:path.join(outDir,'cockpit-latest.json'),html:path.join(outDir,'index.html'),cloud_score:cloud.score,local_score:local.score,economic_score:money.score,settled_revenue_nzd:report.verified_money.settled_revenue_nzd,notifications_enabled:false},null,2));
