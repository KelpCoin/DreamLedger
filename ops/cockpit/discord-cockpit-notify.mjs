import fs from 'node:fs/promises';
import crypto from 'node:crypto';

const enabled = process.env.COCKPIT_DISCORD_ENABLED === 'true';
const killed = process.env.COCKPIT_KILL_SWITCH !== 'false';
const url = process.env.COCKPIT_DISCORD_WEBHOOK_URL || '';
const delayMinutes = Math.max(15, Number(process.env.COCKPIT_DELAY_MINUTES || 15));
const reportPath = process.env.COCKPIT_REPORT_PATH || 'figure-eight-cockpit-latest.json';
if (!enabled) { console.log('DISCORD_COCKPIT=SKIPPED_DISABLED'); process.exit(0); }
if (killed) { console.log('DISCORD_COCKPIT=KILLED'); process.exit(0); }
if (!/^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\//.test(url)) {
  console.log('DISCORD_COCKPIT=BLOCKED_NO_PRIVATE_WEBHOOK'); process.exit(0);
}
const report = JSON.parse(await fs.readFile(reportPath, 'utf8'));
const localHour = Number(new Intl.DateTimeFormat('en-NZ', { timeZone: 'Pacific/Auckland', hour: '2-digit', hourCycle: 'h23' }).format(new Date()));
if (localHour >= 2 && localHour < 9) { console.log('DISCORD_COCKPIT=SKIPPED_QUIET_HOURS_NZ'); process.exit(0); }
const statePath = process.env.COCKPIT_NOTIFY_STATE_PATH || 'cockpit-notify-state.json';
let prior = {};
try { prior = JSON.parse(await fs.readFile(statePath, 'utf8')); } catch {}
const money = report.money_today_nzd || {};
const gates = (report.cloud?.checks || []).filter(item => item.status !== 'PASS');
const digest = crypto.createHash('sha256').update(JSON.stringify({
  day: report.day_nz, cloud: report.cloud?.score, local: report.local?.score,
  verified: money.verified_dreamledger_revenue_nzd, gross: money.gross_charge_amount_nzd,
  gates: gates.map(x => [x.name, x.status])
})).digest('hex');
if (prior.last_digest === digest) { console.log('DISCORD_COCKPIT=SKIPPED_UNCHANGED'); process.exit(0); }
if (Date.now() - Number(prior.last_sent_at_ms || 0) < 6 * 60 * 60 * 1000) { console.log('DISCORD_COCKPIT=RATE_LIMITED'); process.exit(0); }
const ageMs = Date.now() - Date.parse(report.generated_at_utc || '');
if (!Number.isFinite(ageMs) || ageMs < delayMinutes * 60000) { console.log('DISCORD_COCKPIT=STAGED_DELAY_NOT_ELAPSED'); process.exit(0); }
if (process.env.COCKPIT_KILL_SWITCH !== 'false') { console.log('DISCORD_COCKPIT=KILLED_PRE_SEND'); process.exit(0); }
const chargeSummary = money.stripe_balance_transactions_readable
  ? 'NZ$' + Number(money.gross_charge_amount_nzd || 0).toFixed(2) + ' gross / NZ$' + Number(money.net_charge_balance_amount_nzd || 0).toFixed(2) + ' net'
  : 'UNAVAILABLE (live Stripe ledger read failed)';
const lines = [
  '**Private economic cockpit**',
  'NZ day: ' + (report.day_nz || 'unknown'),
  'Cloud readiness: ' + Number(report.cloud?.score || 0) + '/10000',
  'Local readiness: ' + Number(report.local?.score || 0) + '/10000 (' + (report.local?.status || 'UNOBSERVED') + ')',
  'Stripe charge movements: ' + chargeSummary,
  'Verified DreamLedger revenue: NZ$' + Number(money.verified_dreamledger_revenue_nzd || 0).toFixed(2) + ' (' + (money.verified_revenue_status || 'UNVERIFIED') + ')',
  'Settled payments: ' + (money.settled_external_payments ?? 'UNVERIFIED') + '; independent buyers: ' + (money.independent_buyers ?? 'UNVERIFIED'),
  'Paid fulfilled orders: ' + (money.paid_fulfilled_orders ?? 'UNVERIFIED') + '; verified outcomes: ' + (money.verified_outcomes ?? 'UNVERIFIED'),
  'Issues needing attention: ' + gates.length,
  ...gates.slice(0, 5).map(item => '- ' + item.name + ': ' + item.status),
  'Read-only summary. No production configuration changed.'
];
const response = await fetch(url, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ content: lines.join('\n').slice(0, 1900), allowed_mentions: { parse: [] } })
});
if (!response.ok) throw new Error('Discord webhook HTTP ' + response.status + '; response body suppressed.');
await fs.writeFile(statePath, JSON.stringify({ last_digest: digest, last_sent_at_ms: Date.now() }, null, 2) + '\n', { mode: 0o600 });
console.log('DISCORD_COCKPIT=DELIVERED');
