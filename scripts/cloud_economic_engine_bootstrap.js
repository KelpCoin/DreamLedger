'use strict';
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const REPORT_PATH = path.resolve(ROOT, process.env.DREAMLEDGER_BOOTSTRAP_REPORT || 'artifacts/777/bootstrap/commissioning-report.json');
const CANONICAL_REVENUE_FUNCTION = 'stripe-revenue-41104f355d6878cdd6d1f9dc';
const COMMANDER_LINK_ID = 'plink_1UKS00EGgEAnUFF9kUjraaL5';
const PUBLIC_TARGETS = [
  { id: 'dreamledger1_healthz', url: 'https://dreamledger1.onrender.com/healthz' },
  { id: 'dreamledger1_version', url: 'https://dreamledger1.onrender.com/version' },
  { id: 'silo_gateway_healthz', url: 'https://dreamledger-silo-gateway.onrender.com/healthz' },
  { id: 'static_site', url: 'https://dreamledger-org.onrender.com/' },
  { id: 'marketplace_diagnostic_delivery', url: 'https://wbwgroygjeyukkspnqiy.supabase.co/functions/v1/marketplace-diagnostic-delivery', expected_status: [400], expected_body: 'Missing session_id' },
  { id: 'marketplace_diagnostic_input', url: 'https://wbwgroygjeyukkspnqiy.supabase.co/functions/v1/marketplace-diagnostic-input', expected_status: [405], expected_body: 'POST required' },
];

async function safeFetch(url, options = {}, fetchImpl = fetch) {
  const method = String(options.method || 'GET').toUpperCase();
  if (!['GET', 'HEAD'].includes(method)) throw new Error('READ_ONLY_METHOD_BLOCKED');
  return fetchImpl(url, { ...options, method, signal: options.signal || AbortSignal.timeout(12000), redirect: 'follow' });
}

async function probePublic(fetchImpl = fetch) {
  const results = [];
  for (const target of PUBLIC_TARGETS) {
    try {
      const response = await safeFetch(target.url, { method: 'GET' }, fetchImpl);
      const body = await response.text();
      let finalHost = 'UNKNOWN';
      try { finalHost = new URL(response.url || target.url).host; } catch {}
      const expectedStatus = Array.isArray(target.expected_status) ? target.expected_status : null;
      const statusAccepted = expectedStatus ? expectedStatus.includes(response.status) : response.ok;
      const bodyAccepted = !target.expected_body || body.includes(target.expected_body);
      results.push({ id: target.id, status: statusAccepted && bodyAccepted ? 'PASS' : 'FAIL', http_status: response.status, final_host: finalHost });
    } catch (error) {
      results.push({ id: target.id, status: 'FAIL', error: String(error.message || error).slice(0, 100) });
    }
  }
  return results;
}

async function probeSupabase(env = process.env, fetchImpl = fetch) {
  const base = String(env.SUPABASE_URL || '').replace(/\/+$/, '');
  const key = String(env.SUPABASE_SERVICE_ROLE_KEY || '');
  if (!base || !key) return { status: 'UNVERIFIED_NO_CREDENTIALS', tables: [] };
  let parsed;
  try { parsed = new URL(base); } catch { return { status: 'FAIL', reason: 'invalid_supabase_url', tables: [] }; }
  if (parsed.protocol !== 'https:') return { status: 'FAIL', reason: 'https_required', tables: [] };
  const tables = [];
  for (const table of ['marketplace_orders', 'marketplace_fulfillments']) {
    try {
      const url = base + '/rest/v1/' + table + '?select=*&limit=0';
      const response = await safeFetch(url, {
        method: 'HEAD',
        headers: { apikey: key, Authorization: 'Bearer ' + key, Prefer: 'count=exact' },
      }, fetchImpl);
      tables.push({ table, status: response.ok ? 'PASS' : 'FAIL', http_status: response.status });
    } catch (error) {
      tables.push({ table, status: 'FAIL', error: String(error.message || error).slice(0, 100) });
    }
  }
  return { status: tables.every(x => x.status === 'PASS') ? 'PASS' : 'FAIL', tables };
}

async function stripeGet(pathname, key, fetchImpl) {
  const response = await safeFetch('https://api.stripe.com/v1/' + pathname, {
    method: 'GET', headers: { Authorization: 'Bearer ' + key },
  }, fetchImpl);
  const text = await response.text();
  let payload = {};
  try { payload = text ? JSON.parse(text) : {}; } catch {}
  if (!response.ok) return { ok: false, status: response.status, payload: {} };
  return { ok: true, status: response.status, payload };
}

async function probeStripe(env = process.env, fetchImpl = fetch) {
  const key = String(env.STRIPE_SECRET_KEY || '');
  if (!key) return {
    status: 'UNVERIFIED_NO_CREDENTIALS', mode: 'UNKNOWN',
    canonical_revenue_webhook: 'UNVERIFIED', commander_payment_link: 'UNVERIFIED',
    active_payment_link_count: null,
  };
  const mode = key.startsWith('sk_live_') ? 'LIVE' : key.startsWith('sk_test_') ? 'TEST' : 'UNKNOWN';
  try {
    const results = await Promise.all([
      stripeGet('webhook_endpoints?limit=100', key, fetchImpl),
      stripeGet('payment_links?active=true&limit=100', key, fetchImpl),
    ]);
    const webhookResponse = results[0], linksResponse = results[1];
    if (!webhookResponse.ok || !linksResponse.ok) return {
      status: 'FAIL', mode,
      canonical_revenue_webhook: webhookResponse.ok ? 'NOT_CHECKED' : 'HTTP_' + webhookResponse.status,
      commander_payment_link: linksResponse.ok ? 'NOT_CHECKED' : 'HTTP_' + linksResponse.status,
      active_payment_link_count: linksResponse.ok ? (linksResponse.payload.data || []).length : null,
    };
    const webhooks = webhookResponse.payload.data || [], links = linksResponse.payload.data || [];
    const canonical = webhooks.find(item => String(item.url || '').includes(CANONICAL_REVENUE_FUNCTION));
    const commanderLinks = links.filter(item => {
      const skuValues = [item.metadata?.dreamledger_sku, item.metadata?.sku_id, item.metadata?.sku]
        .map(value => String(value || '').trim().toUpperCase());
      return item.id === COMMANDER_LINK_ID || skuValues.includes('CMD-DIAG-29') || skuValues.includes('COMMANDER-DECK-DIAGNOSTIC-001');
    });
    const commander = commanderLinks.find(item => item.id === COMMANDER_LINK_ID) || commanderLinks[0] || null;
    const canonicalState = !canonical
      ? 'MISSING'
      : (canonical.status === 'disabled' || canonical.disabled_reason)
        ? 'DISABLED'
        : canonical.status === 'enabled'
          ? 'ENABLED'
          : 'UNVERIFIED';
    const commanderState = !commander ? 'MISSING_OR_INACTIVE' : 'ACTIVE';
    const sessionResponses = await Promise.all(commanderLinks.map(item =>
      stripeGet('checkout/sessions?payment_link=' + encodeURIComponent(item.id) + '&limit=100', key, fetchImpl)
    ));
    const sessionProbeOk = commanderLinks.length > 0 && sessionResponses.every(item => item.ok);
    const sessions = sessionResponses.flatMap(item => item.ok ? (item.payload.data || []) : []);
    const paidLiveSessions = sessions.filter(item => item.livemode === true && item.payment_status === 'paid').length;
    const unpaidLiveSessions = sessions.filter(item => item.livemode === true && item.payment_status !== 'paid').length;
    return {
      status: canonicalState === 'ENABLED' && commanderState === 'ACTIVE' && mode === 'LIVE' && sessionProbeOk ? 'PASS' : 'BLOCKED',
      mode, canonical_revenue_webhook: canonicalState,
      canonical_webhook_disabled_reason: canonical ? (canonical.disabled_reason || null) : null,
      commander_payment_link: commanderState, commander_payment_link_count: commanderLinks.length,
      active_payment_link_count: links.length,
      commander_session_probe_status: sessionProbeOk ? 'PASS' : (commanderLinks.length ? 'FAIL' : 'UNVERIFIED_NO_MATCHING_LINK'),
      commander_checkout_sessions_sampled: sessions.length,
      commander_paid_live_sessions_count: paidLiveSessions,
      commander_unpaid_live_sessions_count: unpaidLiveSessions,
    };
  } catch (error) {
    return {
      status: 'FAIL', mode, canonical_revenue_webhook: 'UNVERIFIED',
      commander_payment_link: 'UNVERIFIED', active_payment_link_count: null,
      error: String(error.message || error).slice(0, 100),
    };
  }
}

async function runBootstrap({ mode = 'public-only', env = process.env, fetchImpl = fetch, reportPath = REPORT_PATH } = {}) {
  const report = {
    schema: 'DREAMLEDGER/CLOUD-ECONOMIC-ENGINE-BOOTSTRAP/v1',
    generated_at_utc: new Date().toISOString(),
    runtime: 'GITHUB_ACTIONS_CLOUD',
    local_pc_required: false,
    model_calls_enabled: false,
    local_gpu: {
      status: env.DREAMLEDGER_777_PREFER_LOCAL_GPU === 'true' ? 'OPT_IN_REQUESTED_NOT_PROVEN' : 'DISABLED_BY_DEFAULT',
      endpoint_configured: Boolean(env.LM_STUDIO_URL),
    },
    public_surfaces: await probePublic(fetchImpl),
    supabase: mode === 'commerce' ? await probeSupabase(env, fetchImpl) : { status: 'NOT_PROBED_IN_PULL_REQUEST' },
    stripe: mode === 'commerce' ? await probeStripe(env, fetchImpl) : { status: 'NOT_PROBED_IN_PULL_REQUEST' },
    economic_truth: {
      verified_external_revenue_nzd: 0,
      settled_external_payments: 0,
      independent_external_buyers: 0,
      paid_fulfilled_orders: 0,
      verified_economic_outcomes: 0,
      truth_status: 'UNVERIFIED',
    },
  };
  const publicOk = report.public_surfaces.every(x => x.status === 'PASS');
  const commerceOk = mode === 'commerce' && report.supabase.status === 'PASS' && report.stripe.status === 'PASS';
  report.status = mode === 'public-only'
    ? (publicOk ? 'PUBLIC_SURFACES_PASS_COMMERCE_UNVERIFIED' : 'BLOCKED_OR_UNVERIFIED')
    : (publicOk && commerceOk ? 'INFRASTRUCTURE_PROBES_PASS_TRANSACTION_UNVERIFIED' : 'BLOCKED_OR_UNVERIFIED');
  report.next_actions = [];
  if (!publicOk) report.next_actions.push('Repair failed public cloud health probes before enabling economic actions.');
  if (mode !== 'commerce' || report.supabase.status !== 'PASS') report.next_actions.push('Recover and verify Supabase persistence with read-only probes before enabling settlement or fulfillment.');
  if (mode !== 'commerce' || report.stripe.status !== 'PASS') report.next_actions.push('Verify the canonical live Stripe webhook and the existing paid offer mapping; do not toggle endpoints from this bootstrap.');
  report.next_actions.push('Run an authorized independent-buyer transaction and verify settlement, order, fulfillment, delivery evidence, and reconciliation before claiming revenue.');
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 });
  console.log(JSON.stringify({
    status: report.status,
    public_surfaces: report.public_surfaces.map(x => ({ id: x.id, status: x.status, http_status: x.http_status })),
    supabase: report.supabase.status, stripe: report.stripe.status,
    verified_external_revenue_nzd: 0,
    report_path: path.relative(ROOT, reportPath).split(path.sep).join('/'),
  }, null, 2));
  return report;
}

if (require.main === module) {
  const mode = process.argv.includes('--commerce') ? 'commerce' : 'public-only';
  runBootstrap({ mode }).then(report => {
    if (report.status === 'BLOCKED_OR_UNVERIFIED') process.exitCode = 2;
  }).catch(error => {
    console.error('CLOUD_BOOTSTRAP_FAILED=' + String(error.message || error).slice(0, 200));
    process.exitCode = 1;
  });
}
module.exports = { probePublic, probeSupabase, probeStripe, runBootstrap, safeFetch };
