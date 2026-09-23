#!/usr/bin/env node
/**
 * Cloud Demand + Intent-to-Pay sentinel runner.
 * Safe for GitHub Actions. Writes machine-readable reports only.
 * Does NOT claim revenue. Does NOT post publicly. Does NOT invent buyers.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { corroborate } = require('./corroboration.js');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');
const LIVE = process.env.LIVE_URL || 'https://dreamledger.org';
const RUN_ID = process.env.GITHUB_RUN_ID || `local-${Date.now()}`;
const TS = new Date().toISOString();

const LOOPS = [
  {
    loop_id: 'LOOP-BILLBOARD-FOUNDING-50',
    label: 'Founding Billboard Tile',
    price_nzd: 50,
    buy_path: '/buy/DREAMLEDGER-BILLBOARD-FOUNDING-001',
    surface_paths: ['/', '/billboard'],
  },
  {
    loop_id: 'LOOP-CMD-DIAG-29',
    label: 'Commander Deck Diagnostic',
    price_nzd: 29,
    buy_path: '/buy/COMMANDER-DECK-DIAGNOSTIC-001',
    surface_paths: ['/', '/mtg'],
  },
];

async function fetchText(url, timeoutMs = 25000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: { 'user-agent': 'DreamLedger-CloudSentinel/1.0 (+github actions; demand probe)' },
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, url: res.url, text, finalUrl: res.url };
  } catch (err) {
    return { ok: false, status: 0, url, text: '', finalUrl: url, error: String(err.message || err) };
  } finally {
    clearTimeout(t);
  }
}

function demandNotesFromSurface(loop, surface) {
  const notes = [];
  if (!surface.ok) {
    notes.push({
      schema: 'BEC-PRIME/DEMAND-NOTE/v1',
      signal: 'D-VIEW',
      loop_id: loop.loop_id,
      source: 'cloud_sentinel',
      detail: `surface_unreachable status=${surface.status}`,
      observed_at: TS,
      weight_hint: 0,
    });
    return notes;
  }
  const body = surface.text || '';
  const lower = body.toLowerCase();
  notes.push({
    schema: 'BEC-PRIME/DEMAND-NOTE/v1',
    signal: 'D-VIEW',
    loop_id: loop.loop_id,
    source: 'cloud_sentinel',
    detail: `surface_ok ${surface.url}`,
    observed_at: TS,
  });
  if (lower.includes('nz$50') || lower.includes('nz$29') || lower.includes(String(loop.price_nzd))) {
    notes.push({
      schema: 'BEC-PRIME/DEMAND-NOTE/v1',
      signal: 'D-SEARCH',
      loop_id: loop.loop_id,
      source: 'cloud_sentinel',
      detail: 'price_visible_on_surface',
      observed_at: TS,
    });
  }
  if (body.includes(loop.buy_path) || body.includes('buy.stripe.com')) {
    notes.push({
      schema: 'BEC-PRIME/DEMAND-NOTE/v1',
      signal: 'D-CLICK',
      loop_id: loop.loop_id,
      source: 'cloud_sentinel',
      detail: 'checkout_affordance_present',
      observed_at: TS,
    });
  }
  return notes;
}

async function intentNotesFromBuyPath(loop) {
  const notes = [];
  const buy = await fetchText(`${LIVE}${loop.buy_path}`);
  const onStripe = /buy\.stripe\.com|checkout\.stripe\.com/i.test(buy.finalUrl || '');
  if (buy.ok && onStripe) {
    notes.push({
      schema: 'BEC-PRIME/INTENT-NOTE/v1',
      signal: 'I-CHECKOUT_OPEN',
      loop_id: loop.loop_id,
      source: 'cloud_sentinel',
      detail: `buy_router_reaches_stripe final=${buy.finalUrl}`,
      observed_at: TS,
      implication: 'Path can open checkout; not a paid session',
    });
  } else {
    notes.push({
      schema: 'BEC-PRIME/INTENT-NOTE/v1',
      signal: 'I-CHECKOUT_ABANDON',
      loop_id: loop.loop_id,
      source: 'cloud_sentinel',
      detail: `buy_router_issue status=${buy.status} final=${buy.finalUrl} err=${buy.error || ''}`,
      observed_at: TS,
      implication: 'Friction or misconfig — not proof of buyer intent',
    });
  }
  return notes;
}

async function probeOffers() {
  const res = await fetchText(`${LIVE}/api/offers`);
  let count = 0;
  let checkoutable = 0;
  try {
    const j = JSON.parse(res.text || '{}');
    const offers = j.offers || [];
    count = offers.length;
    checkoutable = offers.filter((o) => o.checkout_available).length;
  } catch {
    /* ignore */
  }
  return { ok: res.ok, status: res.status, count, checkoutable };
}

async function main() {
  const allDemand = [];
  const allIntent = [];
  const loopReports = [];

  const offers = await probeOffers();
  allDemand.push({
    schema: 'BEC-PRIME/DEMAND-NOTE/v1',
    signal: 'D-AGENT',
    loop_id: 'LOOP-CATALOG',
    source: 'cloud_sentinel',
    detail: `api_offers status=${offers.status} count=${offers.count} checkoutable=${offers.checkoutable}`,
    observed_at: TS,
  });

  for (const loop of LOOPS) {
    for (const p of loop.surface_paths) {
      const surface = await fetchText(`${LIVE}${p}`);
      allDemand.push(...demandNotesFromSurface(loop, surface));
    }
    const intent = await intentNotesFromBuyPath(loop);
    allIntent.push(...intent);
    const corr = corroborate(
      allDemand.filter((n) => n.loop_id === loop.loop_id),
      allIntent.filter((n) => n.loop_id === loop.loop_id),
      loop.loop_id
    );
    loopReports.push({ loop, corroboration: corr });
  }

  const global = corroborate(allDemand, allIntent, null);

  const report = {
    schema: 'BEC-PRIME/CLOUD-SENTINEL-REPORT/v1',
    run_id: RUN_ID,
    observed_at: TS,
    live_url: LIVE,
    verified_external_revenue_nzd: 0,
    revenue_claim: 'NONE — probes are not payments',
    offers_api: offers,
    demand_notes: allDemand,
    intent_notes: allIntent,
    loops: loopReports,
    global_corroboration: global,
    operator_next:
      global.band === 'HOT' || global.band === 'INTENT_HEAVY'
        ? 'Checkout path is reachable — execute DEMAND-KIT posts if not already'
        : global.band === 'DEMAND_HEAVY'
          ? 'Surfaces expose offers — push distribution (THIS-WEEK-COMMAND)'
          : 'Keep posting; sentinel only confirms rails, not buyers',
  };

  const outDir = path.join(ROOT, 'AGENT_BUS', 'sentinel-reports');
  const demandDir = path.join(ROOT, 'ops', 'demand');
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(demandDir, { recursive: true });

  const stamp = TS.replace(/[:.]/g, '-');
  const latestPath = path.join(outDir, 'latest.json');
  const stampedPath = path.join(outDir, `report-${stamp}.json`);
  const demandLatest = path.join(demandDir, 'latest-cloud.json');

  const body = JSON.stringify(report, null, 2) + '\n';
  fs.writeFileSync(latestPath, body);
  fs.writeFileSync(stampedPath, body);
  fs.writeFileSync(demandLatest, body);

  // Compact handoff for humans / LLMs
  const handoff = `# Cloud sentinel report\n\n- run_id: ${RUN_ID}\n- observed_at: ${TS}\n- global_band: **${global.band}**\n- demand_score: ${global.demand_score}\n- intent_score: ${global.intent_score}\n- offers_checkoutable: ${offers.checkoutable}\n- verified_external_revenue_nzd: **0**\n- revenue_claim: NONE\n\nFull JSON: \\`AGENT_BUS/sentinel-reports/latest.json\\`\n\nOperator: still run \\`ops/money/DEMAND-KIT.md\\` — sentinel does not replace posts.\n`;
  fs.writeFileSync(path.join(outDir, 'LATEST-HANDOFF.md'), handoff);

  console.log(JSON.stringify({ ok: true, band: global.band, wrote: [latestPath, demandLatest] }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
