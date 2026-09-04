'use strict';

const cp = require('child_process');

const key = String(process.env.STRIPE_SECRET_KEY || '').trim();
const enabled = String(process.env.STRIPE_LIVE_ENABLED || '').toLowerCase() === 'true';
const repo = String(process.env.GITHUB_REPOSITORY || 'KelpCoin/DreamLedger');
const recentDays = Number(process.env.CHECKOUT_SIGNAL_RECENT_DAYS || 14);
const linkIds = new Set(
  String(process.env.CHECKOUT_SIGNAL_PAYMENT_LINK_IDS || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
);

if (!enabled) {
  console.log(JSON.stringify({ status: 'SKIPPED', reason: 'STRIPE_LIVE_ENABLED is not true.', signals: 0 }, null, 2));
  process.exit(0);
}
if (!/^sk_live_/.test(key)) throw new Error('STRIPE_SECRET_KEY is not a live-mode key.');
if (!linkIds.size) throw new Error('No checkout payment-link IDs configured for signal detection.');

async function stripeList(url) {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
  const text = await response.text();
  if (!response.ok) throw new Error(`Stripe ${response.status}: ${text}`);
  return JSON.parse(text);
}

function issueExists(title) {
  const r = cp.spawnSync(
    'gh',
    ['issue', 'list', '--repo', repo, '--state', 'all', '--search', `in:title \"${title}\"`, '--limit', '1', '--json', 'number,title'],
    { encoding: 'utf8' }
  );
  if (r.status !== 0) throw new Error(r.stderr || 'gh issue list failed');
  const rows = JSON.parse(r.stdout || '[]');
  return Array.isArray(rows) && rows.length > 0;
}

function createIssue(title, body) {
  const r = cp.spawnSync('gh', ['issue', 'create', '--repo', repo, '--title', title, '--body', body], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr || r.stdout || 'gh issue create failed');
  return r.stdout.trim();
}

async function main() {
  const cutoff = Math.floor(Date.now() / 1000) - Math.max(1, recentDays) * 86400;
  const payload = await stripeList('https://api.stripe.com/v1/checkout/sessions?limit=100');
  const sessions = Array.isArray(payload.data) ? payload.data : [];
  let signals = 0;
  let created = 0;

  for (const s of sessions) {
    const link = String(s.payment_link || '');
    const createdAt = Number(s.created || 0);
    if (!linkIds.has(link) || createdAt < cutoff || s.payment_status === 'paid') continue;
    const state = String(s.status || '').toLowerCase();
    if (!['open', 'expired', 'complete'].includes(state)) continue;

    signals += 1;
    const title = `CHECKOUT SIGNAL ${s.id}`;
    if (issueExists(title)) continue;

    const metadata = s.metadata || {};
    const body = [
      '# Checkout intent signal',
      '',
      `Session: ${s.id}`,
      `Payment link: ${link}`,
      `Status: ${s.status}`,
      `Payment status: ${s.payment_status}`,
      `Amount: ${(Number(s.amount_total || 0) / 100).toFixed(2)} ${String(s.currency || '').toUpperCase()}`,
      `Created: ${new Date(createdAt * 1000).toISOString()}`,
      `Offer ID: ${metadata.offer_id || 'unknown'}`,
      `Product ID: ${metadata.product_id || 'unknown'}`,
      `SKU: ${metadata.dreamledger_sku || metadata.product_sku || 'unknown'}`,
      '',
      '## Interpretation',
      'Buyer reached a configured checkout surface but no paid event is being claimed by this signal.',
      'This is behavioral evidence only, not revenue evidence.',
      '',
      '## Policy',
      'Do not contact the buyer automatically. Do not mark revenue. Use this signal to prioritize human-led conversion experiments.',
      '',
      'This issue was generated deterministically from live Stripe checkout data.'
    ].join('\n');
    createIssue(title, body);
    created += 1;
  }

  console.log(JSON.stringify({ status: 'PASS', scanned_sessions: sessions.length, signals, created, revenue_claimed_nzd: 0 }, null, 2));
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : String(err));
  process.exit(1);
});
