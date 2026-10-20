'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const DIAGNOSTIC_ID = 'COMMANDER-DECK-DIAGNOSTIC-001';
const KNOWN_QUARANTINED_IDS = ['EDH_0001', 'EDH_JON_IRENICUS_0004'];

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function isSafeIntegerAboveZero(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function checkoutApproved(feed, live) {
  return feed.checkout_available === true &&
    live.checkout_available === true &&
    feed.checkout_approved === true &&
    live.commercial_truth &&
    live.commercial_truth.approval_required === false &&
    typeof feed.checkout_url === 'string' &&
    feed.checkout_url === live.checkout_url &&
    /^https:\/\/buy\.stripe\.com\/[A-Za-z0-9]+/.test(feed.checkout_url);
}

function reconcileProducts(feedCatalogue, liveCatalogue) {
  const liveById = new Map();
  for (const item of (liveCatalogue.products || [])) {
    if (item && item.id && item.silo === 'mtg' && item.status === 'published') {
      const id = String(item.id);
      if (!liveById.has(id)) liveById.set(id, []);
      liveById.get(id).push(item);
    }
  }

  const eligible = [];
  const quarantined = [];
  for (const feed of (feedCatalogue.products || [])) {
    const id = String((feed && feed.id) || '');
    const matches = liveById.get(id) || [];
    let reason = '';
    let live = matches[0];

    if (!feed || !id) reason = 'INVALID_PRODUCT_ID';
    else if (matches.length !== 1) reason = matches.length ? 'DUPLICATE_LIVE_ID' : 'NO_UNIQUE_PUBLISHED_MTG_MATCH';
    else if (feed.silo !== 'mtg' || live.silo !== 'mtg') reason = 'SILO_MISMATCH';
    else if (feed.status !== 'published' || live.status !== 'published') reason = 'STATUS_NOT_PUBLISHED';
    else if (feed.category !== 'commander-deck' && !/^EDH/i.test(id)) reason = 'NOT_A_COMMANDER_DECK';
    else if (String(feed.currency || '').toLowerCase() !== 'nzd' ||
             String(live.currency || '').toLowerCase() !== 'nzd') reason = 'CURRENCY_NOT_NZD';
    else if (!isSafeIntegerAboveZero(feed.inventory) ||
             !isSafeIntegerAboveZero(live.inventory)) reason = 'STOCK_NOT_CONFIRMED_IN_BOTH_CATALOGUES';
    else if (!Number.isFinite(Number(feed.price)) || Number(feed.price) <= 0 ||
             Number(feed.price) !== Number(live.price)) reason = 'PRICE_MISMATCH';
    else {
      const manual = feed.checkout_available === false &&
        live.checkout_available === false &&
        !feed.checkout_url &&
        !live.checkout_url &&
        feed.sale_mode === 'claim_by_message';
      const online = checkoutApproved(feed, live);
      if (!manual && !online) reason = 'SALE_MODE_NOT_EXPLICITLY_ALLOWED';
      else eligible.push({
        id,
        name: live.name || feed.name || id,
        price_nzd: Number(feed.price),
        inventory: Math.min(feed.inventory, live.inventory),
        mode: online ? 'approved_online_checkout' : 'manual_enquiry',
        checkout_available: online
      });
    }

    if (reason) quarantined.push({ id: id || null, reason });
  }
  return { eligible, quarantined };
}

function evaluateSource(root = ROOT) {
  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail) });
  let report;
  try {
    const server = fs.readFileSync(path.join(root, 'public/server.js'), 'utf8');
    const pagePath = path.join(root, 'public/mtg/index.html');
    const page = fs.readFileSync(pagePath, 'utf8');
    const legacyMaster = fs.readFileSync(path.join(root, 'public/mtg/master.html'), 'utf8');
    const feed = JSON.parse(fs.readFileSync(path.join(root, 'public/data/mtg-catalog.json'), 'utf8'));
    const aggregate = JSON.parse(fs.readFileSync(path.join(root, 'public/catalog.json'), 'utf8'));
    const diagnostic = JSON.parse(fs.readFileSync(path.join(root, 'BEC-PRIME/catalog/products/' + DIAGNOSTIC_ID + '.json'), 'utf8'));
    const publicDiagnostic = (aggregate.products || []).find(p => p && p.id === DIAGNOSTIC_ID);
    const reconciled = reconcileProducts(feed, aggregate);
    const eligibleIds = reconciled.eligible.map(p => p.id);

    add('mtg_route_without_redirect_loop',
      /['"]\/mtg['"]\s*:\s*['"]mtg\/index\.html['"]/.test(server) &&
      /['"]\/mtg\/['"]\s*:\s*['"]mtg\/index\.html['"]/.test(server) &&
      /['"]\/mtg\.html['"]\s*:\s*['"]mtg\/index\.html['"]/.test(server) &&
      fs.existsSync(pagePath) &&
      !/http-equiv\s*=\s*["']refresh["']/i.test(page),
      'Canonical MTG aliases directly serve public/mtg/index.html; that page has no meta-refresh loop.');
    add('production_version_has_commit_identity',
      /JSON\.stringify\(\{service:'dreamledger-storefront',status:'ok',mtg:'master',commit:COMMIT\}\)/.test(server),
      'The read-only /version endpoint exposes the deployed commit for convergence checks.');
    add('mtg_catalogue_marker',
      /name=["']dreamledger-mtg-contract["']\s+content=["']v1["']/.test(page),
      'The canonical MTG page includes the v1 route-contract marker.');
    add('two_catalogue_read_fail_closed',
      page.includes("fetch('/data/mtg-catalog.json'") &&
      page.includes("fetch('/api/products'") &&
      page.includes('Catalogue sources could not be reconciled') &&
      page.includes("grid.innerHTML=''"),
      'Listing cards require both catalogues; errors clear cards instead of displaying stale stock.');
    add('diagnostic_not_advertised_for_payment',
      !page.includes('/buy/' + DIAGNOSTIC_ID) &&
      !/https:\/\/buy\.stripe\.com\//.test(page) &&
      page.includes('Commander Deck Diagnostic: currently held'),
      'The public page states the diagnostic is held and has no direct diagnostic purchase link.');
    add('canonical_diagnostic_remains_held',
      diagnostic.status === 'held' &&
      diagnostic.inventory === 0 &&
      diagnostic.checkout && diagnostic.checkout.mode === 'disabled' &&
      diagnostic.checkout.url === null &&
      diagnostic.commercial_truth &&
      diagnostic.commercial_truth.approval_required === true &&
      diagnostic.commercial_truth.sellable === false,
      'Canonical diagnostic remains held, inventory zero, checkout disabled, and approval required.');
    add('public_diagnostic_remains_non_purchasable',
      Boolean(publicDiagnostic) &&
      publicDiagnostic.status === 'held' &&
      publicDiagnostic.checkout_available === false &&
      !publicDiagnostic.checkout_url,
      'The aggregate public catalogue keeps the diagnostic held with no checkout URL.');
    add('two_source_inventory_reconciles',
      eligibleIds.includes('EDH_QUINTORIUS_0002') &&
      eligibleIds.includes('EDH_DWYNEN_0003') &&
      eligibleIds.length === 2,
      'Only the two physical decks whose identity, price, currency, stock, status, and manual sale mode reconcile are eligible: ' + eligibleIds.join(', '));
    add('known_conflicts_are_quarantined',
      !eligibleIds.includes('EDH_0001') &&
      !eligibleIds.includes('EDH_JON_IRENICUS_0004') &&
      reconciled.quarantined.some(p => p.id === 'EDH_0001') &&
      reconciled.quarantined.some(p => p.id === 'EDH_JON_IRENICUS_0004'),
      'The EDH_0001 identity/price collision and Jon Irenicus NZ$90/NZ$220 price mismatch remain hidden.');
    add('no_unapproved_online_checkout',
      reconciled.eligible.filter(p => p.checkout_available).length === 0,
      'No MTG product currently passes the explicit dual-catalogue checkout approval rule.');

    const pass = checks.every(c => c.pass);
    report = {
      schema: 'DREAMLEDGER-MTG-PUBLIC-CONTRACT/v1',
      status: pass ? 'PASS_SOURCE_CONTRACT_ONLY' : 'FAIL_SOURCE_CONTRACT',
      production_status: 'NOT_PROBED',
      timestamp_utc: new Date().toISOString(),
      repository: 'KelpCoin/DreamLedger',
      verified_external_revenue_nzd: 0,
      checkout_created: false,
      production_mutated: false,
      candidate_silos_changed: 0,
      eligible_listings: reconciled.eligible,
      quarantined_listings: reconciled.quarantined,
      checks
    };
  } catch (error) {
    report = {
      schema: 'DREAMLEDGER-MTG-PUBLIC-CONTRACT/v1',
      status: 'FAIL_SOURCE_CONTRACT',
      production_status: 'NOT_PROBED',
      timestamp_utc: new Date().toISOString(),
      repository: 'KelpCoin/DreamLedger',
      verified_external_revenue_nzd: 0,
      checks: checks.concat([{ id: 'source_read_and_parse', pass: false, detail: String(error && error.message || error) }])
    };
  }
  return report;
}

async function verifyProduction(baseUrl, expectedCommit, sourceRoot = ROOT) {
  const base = String(baseUrl || 'https://dreamledger.org').replace(/\/+$/, '');
  const checks = [];
  const responses = {};
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail) });

  async function get(route, parseJson) {
    try {
      const response = await fetch(base + route, {
        redirect: 'manual',
        signal: AbortSignal.timeout(12000),
        headers: { 'cache-control': 'no-cache' }
      });
      const body = await response.text();
      add('http_' + route.replace(/[^a-z0-9]+/gi, '_'), response.status === 200,
        route + ' returned HTTP ' + response.status + ' (' + body.length + ' bytes).');
      let parsed = null;
      if (parseJson) {
        try { parsed = JSON.parse(body); }
        catch (error) {
          add('json_' + route.replace(/[^a-z0-9]+/gi, '_'), false, 'Invalid JSON at ' + route + ': ' + error.message);
        }
      }
      responses[route] = { status: response.status, body, parsed };
      return responses[route];
    } catch (error) {
      add('http_' + route.replace(/[^a-z0-9]+/gi, '_'), false, route + ' request failed: ' + String(error && error.message || error));
      responses[route] = { status: 0, body: '', parsed: null };
      return responses[route];
    }
  }

  const [health, version, mtgNoSlash, mtgSlash, liveProducts, liveCatalog, feedCatalog, robots, sitemap] = await Promise.all([
    get('/healthz', true),
    get('/version', true),
    get('/mtg', false),
    get('/mtg/', false),
    get('/api/products', true),
    get('/catalog.json', true),
    get('/data/mtg-catalog.json', true),
    get('/robots.txt', false),
    get('/sitemap.xml', false)
  ]);
  add('production_health_contract',
    Boolean(health.parsed && health.parsed.ok === true && health.parsed.service === 'dreamledger-storefront'),
    'The storefront health endpoint reports the expected live service and ok=true.');

  for (const [name, result] of [['/mtg', mtgNoSlash], ['/mtg/', mtgSlash]]) {
    add('page_marker_' + name.replace(/\W/g, '_'),
      result.status === 200 && /name=["']dreamledger-mtg-contract["']\s+content=["']v1["']/.test(result.body),
      name + ' returns the canonical MTG page marker, not the former redirect target.');
    add('page_no_redirect_loop_' + name.replace(/\W/g, '_'),
      !/http-equiv\s*=\s*["']refresh["']/i.test(result.body),
      name + ' does not return a meta-refresh loop.');
    add('diagnostic_held_notice_' + name.replace(/\W/g, '_'),
      result.body.includes('Commander Deck Diagnostic: currently held') &&
      !result.body.includes('/buy/' + DIAGNOSTIC_ID),
      name + ' states the diagnostic is held and contains no dead purchase route.');
  }

  const liveCommit = version.parsed && version.parsed.commit ? String(version.parsed.commit) : '';
  add('production_commit_matches_expected',
    Boolean(liveCommit) && liveCommit !== 'unknown' && (!expectedCommit || liveCommit === expectedCommit),
    'Expected ' + (expectedCommit || '(non-unknown commit)') + '; live ' + (liveCommit || '(missing)') + '.');

  const sourceReport = evaluateSource(sourceRoot);
  const localEligible = (sourceReport.eligible_listings || []).map(p => p.id).sort();
  const aggregate = liveCatalog.parsed;
  const published = liveProducts.parsed;
  const feed = feedCatalog.parsed;
  let liveEligible = [];
  if (aggregate && Array.isArray(aggregate.products) &&
      published && Array.isArray(published.products) &&
      feed && Array.isArray(feed.products)) {
    liveEligible = reconcileProducts(feed, aggregate).eligible.map(p => p.id).sort();
    add('live_listings_match_source_contract',
      JSON.stringify(liveEligible) === JSON.stringify(localEligible) &&
      localEligible.length > 0,
      'Source eligible IDs: ' + localEligible.join(', ') + '; live eligible IDs: ' + liveEligible.join(', ') + '.');

    const sourceDiagnostic = aggregate.products.find(p => p && p.id === DIAGNOSTIC_ID);
    const apiDiagnostic = published.products.find(p => p && p.id === DIAGNOSTIC_ID);
    add('live_diagnostic_remains_held',
      Boolean(sourceDiagnostic) &&
      sourceDiagnostic.status === 'held' &&
      sourceDiagnostic.checkout_available === false &&
      !sourceDiagnostic.checkout_url &&
      !apiDiagnostic,
      'The full public catalogue records the diagnostic as held; the published-product API does not expose it as sellable.');
  } else {
    add('live_catalogue_shapes', false, 'Could not parse the two live catalogues and published product response.');
  }

  add('live_robots_sitemap',
    robots.status === 200 && sitemap.status === 200,
    'robots.txt returned HTTP ' + robots.status + '; sitemap.xml returned HTTP ' + sitemap.status + '.');

  const pass = checks.every(c => c.pass);
  return {
    schema: 'DREAMLEDGER-MTG-PUBLIC-CONTRACT/v1',
    status: pass ? 'PASS_PRODUCTION_ROUTE_AND_HOLD_CONTRACT' : 'FAIL_PRODUCTION_CONTRACT',
    production_status: pass ? 'VERIFIED_ROUTE_AND_HOLD_STATE' : 'NOT_VERIFIED',
    timestamp_utc: new Date().toISOString(),
    base_url: base,
    expected_commit: expectedCommit || null,
    live_commit: liveCommit || null,
    verified_external_revenue_nzd: 0,
    checkout_created: false,
    production_mutated: false,
    source_status: sourceReport.status,
    source_eligible_listing_ids: localEligible,
    live_eligible_listing_ids: liveEligible,
    checks
  };
}

function parseArgs(argv) {
  const out = { production: false, out: null, expectedCommit: process.env.EXPECTED_COMMIT || '', baseUrl: process.env.MTG_BASE_URL || 'https://dreamledger.org' };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--production') out.production = true;
    else if (argv[i] === '--out' && argv[i + 1]) out.out = argv[++i];
    else if (argv[i] === '--expected-commit' && argv[i + 1]) out.expectedCommit = argv[++i];
    else if (argv[i] === '--base-url' && argv[i + 1]) out.baseUrl = argv[++i];
    else throw new Error('Unknown or incomplete argument: ' + argv[i]);
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const report = evaluateSource();
  let finalReport = report;
  if (args.production) {
    finalReport = await verifyProduction(args.baseUrl, args.expectedCommit, ROOT);
    if (report.status !== 'PASS_SOURCE_CONTRACT_ONLY') {
      finalReport.status = 'FAIL_SOURCE_AND_PRODUCTION_CONTRACT';
      finalReport.source_checks = report.checks;
    }
  }
  const json = JSON.stringify(finalReport, null, 2) + '\n';
  if (args.out) {
    const output = path.resolve(args.out);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, json, 'utf8');
    console.log('PROOF_FILE=' + output);
  }
  console.log('MTG_CONTRACT_STATUS=' + finalReport.status);
  console.log('PRODUCTION_STATUS=' + finalReport.production_status);
  console.log('VERIFIED_EXTERNAL_REVENUE_NZD=' + Number(finalReport.verified_external_revenue_nzd || 0).toFixed(2));
  for (const check of (finalReport.checks || [])) {
    console.log((check.pass ? 'PASS ' : 'FAIL ') + check.id + ' :: ' + check.detail);
  }
  if (finalReport.status.startsWith('FAIL')) process.exitCode = 1;
}

if (require.main === module) {
  main().catch(error => {
    console.error('MTG_CONTRACT_FATAL=' + String(error && error.stack || error));
    process.exitCode = 1;
  });
}

module.exports = { evaluateSource, reconcileProducts, verifyProduction };
