#!/usr/bin/env node
'use strict';

// Read-only Stripe webhook inventory. This does not create, update, or disable endpoints.
// It reports routing ambiguity for human review; it never guesses which endpoint is canonical.
import fs from 'node:fs/promises';
import path from 'node:path';

const projectRef = 'wbwgroygjeyukkspnqiy';
const baseUrl = 'https://api.stripe.com/v1';
const expectedTargets = [
  {
    name: 'dreamledger-stripe-webhook-v3',
    url: `https://${projectRef}.supabase.co/functions/v1/dreamledger-stripe-webhook-v3`,
    knownRole: 'observation_and_cube_reconciliation'
  },
  {
    name: 'stripe-revenue-41104f355d6878cdd6d1f9dc',
    url: `https://${projectRef}.supabase.co/functions/v1/stripe-revenue-41104f355d6878cdd6d1f9dc`,
    knownRole: 'order_entitlement_and_fulfillment_logic'
  }
];

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing STRIPE_SECRET_KEY. Set it locally; never paste it into chat or logs.');
}
if (process.env.STRIPE_LIVE_ENABLED !== 'true') {
  throw new Error('Fail-closed: set STRIPE_LIVE_ENABLED=true to permit read-only live Stripe inspection.');
}

async function stripe(pathAndQuery) {
  const response = await fetch(baseUrl + pathAndQuery, {
    headers: { Authorization: 'Bearer ' + process.env.STRIPE_SECRET_KEY }
  });
  const text = await response.text();
  if (!response.ok) throw new Error('Stripe API returned HTTP ' + response.status + '; response body suppressed.');
  return JSON.parse(text);
}

async function listAllEndpoints() {
  const rows = [];
  let cursor;
  for (;;) {
    const query = new URLSearchParams({ limit: '100' });
    if (cursor) query.set('starting_after', cursor);
    const page = await stripe('/webhook_endpoints?' + query.toString());
    rows.push(...(page.data || []));
    if (!page.has_more || !page.data?.length) return rows;
    cursor = page.data[page.data.length - 1].id;
  }
}

const endpoints = await listAllEndpoints();
const sanitized = endpoints.map(endpoint => ({
  id: endpoint.id,
  url: endpoint.url,
  status: endpoint.status || 'UNKNOWN',
  livemode: endpoint.livemode === true,
  enabled_events: Array.isArray(endpoint.enabled_events) ? endpoint.enabled_events : [],
  api_version: endpoint.api_version || null,
  created_utc: Number.isFinite(endpoint.created) ? new Date(endpoint.created * 1000).toISOString() : null
}));
const expected = expectedTargets.map(target => {
  const matches = sanitized.filter(endpoint => endpoint.url.replace(/\/$/, '') === target.url);
  return {
    ...target,
    endpoint_count: matches.length,
    endpoints: matches.map(endpoint => ({
      id: endpoint.id,
      status: endpoint.status,
      livemode: endpoint.livemode,
      enabled_events: endpoint.enabled_events
    }))
  };
});
const active = sanitized.filter(endpoint => endpoint.status === 'enabled');
const activeLive = active.filter(endpoint => endpoint.livemode);
const eventDestinations = new Map();
for (const endpoint of activeLive) {
  for (const event of endpoint.enabled_events) {
    if (event === '*') continue;
    if (!eventDestinations.has(event)) eventDestinations.set(event, []);
    eventDestinations.get(event).push({ id: endpoint.id, url: endpoint.url });
  }
}
const duplicateEventRouting = [...eventDestinations.entries()]
  .filter(([, destinations]) => destinations.length > 1)
  .map(([event, destinations]) => ({ event, destinations }));
const unknownLiveTargets = activeLive.filter(endpoint =>
  !expectedTargets.some(target => endpoint.url.replace(/\/$/, '') === target.url)
);
const bothKnownActive = expected.every(target =>
  target.endpoint_count === 1 &&
  target.endpoints.some(endpoint => endpoint.status === 'enabled' && endpoint.livemode)
);
const report = {
  schema: 'BECK-STRIPE-WEBHOOK-ROUTING-RECONCILIATION/v1',
  generated_at_utc: new Date().toISOString(),
  mode: 'READ_ONLY_LIVE_STRIPE',
  account_mode: 'LIVE_API_KEY_USED',
  endpoint_count: sanitized.length,
  enabled_live_endpoint_count: activeLive.length,
  expected_targets: expected,
  enabled_live_endpoints: activeLive,
  unknown_enabled_live_targets: unknownLiveTargets,
  duplicate_event_routing: duplicateEventRouting,
  verdict: 'REVIEW_REQUIRED',
  reasons: [
    'Inventory proves configured destinations only, not successful delivery or database writes.',
    'Do not disable a legacy endpoint until its event coverage, delivery history, and consumer role are confirmed.',
    'Do not declare a canonical endpoint solely because its URL exists.'
  ]
};

const outDir = path.join(process.cwd(), 'proof', 'commerce');
await fs.mkdir(outDir, { recursive: true });
const outPath = path.join(outDir, 'latest-stripe-webhook-routing.json');
await fs.writeFile(outPath, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
console.log(JSON.stringify({
  artifact: outPath,
  endpoint_count: report.endpoint_count,
  enabled_live_endpoint_count: report.enabled_live_endpoint_count,
  expected_targets: expected.map(target => ({
    name: target.name,
    endpoint_count: target.endpoint_count,
    active_live: target.endpoints.filter(endpoint => endpoint.status === 'enabled' && endpoint.livemode).length
  })),
  unknown_enabled_live_target_count: unknownLiveTargets.length,
  duplicate_event_routing_count: duplicateEventRouting.length,
  verdict: report.verdict
}, null, 2));
