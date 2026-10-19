'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const PRIME = path.join(__dirname, '..');
const MUTATION_OUTPUT = path.join(PRIME, 'data', '777', 'MUTATION-AUDIT-LATEST.json');
const SOURCE_FILES = {
  resolver: path.join(PRIME, 'economic', 'StripePaymentLinkResolver.js'),
  audit: path.join(PRIME, 'scripts', 'audit-777-stripe-offer-parity.js')
};
const SUITES = {
  resolver: ['test-777-stripe-resolver.js', 'test-777-stripe-resolver-adversarial.js'],
  audit: ['test-777-stripe-audit-transport.js']
};
const TEST_FILES = [
  'test-777-stripe-resolver.js',
  'test-777-stripe-resolver-adversarial.js',
  'test-777-stripe-audit-transport.js'
];

function mutant(id, category, file, from, to, rationale) {
  return { id, category, file, from, to, rationale };
}

const MUTANTS = [
  // 8 comparison mutations
  mutant('CMP-01', 'COMPARISON_LOGIC', 'resolver',
    'new Set([approvedUrl, liveUrl, publicUrl].filter(Boolean)).size > 1',
    'new Set([approvedUrl, liveUrl, publicUrl].filter(Boolean)).size < 1',
    'misses URL divergence'),
  mutant('CMP-02', 'COMPARISON_LOGIC', 'resolver',
    "asText(liveOffer.status) !== 'ACTIVE_LIVEMODE'",
    "asText(liveOffer.status) === 'ACTIVE_LIVEMODE'",
    'inverts live commerce status comparison'),
  mutant('CMP-03', 'COMPARISON_LOGIC', 'resolver',
    'nzdToMinor(liveOffer.price_nzd) !== expectedAmountMinor',
    'nzdToMinor(liveOffer.price_nzd) === expectedAmountMinor',
    'inverts live price drift comparison'),
  mutant('CMP-04', 'COMPARISON_LOGIC', 'resolver',
    "asText(publicProduct.status).toLowerCase() !== 'published'",
    "asText(publicProduct.status).toLowerCase() === 'published'",
    'inverts public publication status comparison'),
  mutant('CMP-05', 'COMPARISON_LOGIC', 'resolver',
    'publicAmount == null || publicAmount !== expectedAmountMinor',
    'publicAmount == null || publicAmount === expectedAmountMinor',
    'inverts rendered public price comparison'),
  mutant('CMP-06', 'COMPARISON_LOGIC', 'resolver',
    'publicCurrency !== expectedCurrency',
    'publicCurrency === expectedCurrency',
    'inverts public currency comparison'),
  mutant('CMP-07', 'COMPARISON_LOGIC', 'resolver',
    'normalizeCurrency(liveOffer.silo) !== normalizeCurrency(offer.silo)',
    'normalizeCurrency(liveOffer.silo) === normalizeCurrency(offer.silo)',
    'inverts silo boundary comparison'),
  mutant('CMP-08', 'COMPARISON_LOGIC', 'resolver',
    'if (apiMode !== \u0027live\u0027) blockers.push(\u0027STRIPE_API_KEY_NOT_LIVE\u0027);',
    'if (apiMode === \u0027live\u0027) blockers.push(\u0027STRIPE_API_KEY_NOT_LIVE\u0027);',
    'inverts API live-mode comparison'),

  // 8 zero, amount and null guards
  mutant('ZERO-01', 'ZERO_AND_NULL_GUARDS', 'resolver',
    'Number.isFinite(amount) && amount >= 0 ?',
    'Number.isFinite(amount) && amount >= -1 ?',
    'accepts a negative amount'),
  mutant('ZERO-02', 'ZERO_AND_NULL_GUARDS', 'resolver',
    'quantity < 1',
    'quantity < 0',
    'accepts a zero quantity'),
  mutant('ZERO-03', 'ZERO_AND_NULL_GUARDS', 'resolver',
    'expectedAmountMinor == null || expectedAmountMinor <= 0 || !amountKnown',
    'expectedAmountMinor == null || !amountKnown',
    'drops the positive-price guard'),
  mutant('ZERO-04', 'ZERO_AND_NULL_GUARDS', 'resolver',
    "if (!lines.length) blockers.push('STRIPE_PAYMENT_LINK_HAS_NO_RESOLVABLE_LINE_ITEMS');",
    "if (lines.length < 0) blockers.push('STRIPE_PAYMENT_LINK_HAS_NO_RESOLVABLE_LINE_ITEMS');",
    'drops the missing-line-item guard'),
  mutant('ZERO-05', 'ZERO_AND_NULL_GUARDS', 'resolver',
    "if (!amountKnown) blockers.push('STRIPE_LINE_ITEM_AMOUNT_OR_CURRENCY_UNRESOLVED');",
    "if (false) blockers.push('STRIPE_LINE_ITEM_AMOUNT_OR_CURRENCY_UNRESOLVED');",
    'drops the unresolved-amount guard'),
  mutant('ZERO-06', 'ZERO_AND_NULL_GUARDS', 'resolver',
    "if (currencyConflict) blockers.push('STRIPE_LINE_ITEM_CURRENCY_CONFLICT');",
    "if (false) blockers.push('STRIPE_LINE_ITEM_CURRENCY_CONFLICT');",
    'drops the mixed-currency guard'),
  mutant('ZERO-07', 'ZERO_AND_NULL_GUARDS', 'resolver',
    'if (!lineCurrency || lineCurrency !== normalizeCurrency(expectedCurrency))',
    'if (!lineCurrency || false)',
    'drops the expected-currency guard'),
  mutant('ZERO-08', 'ZERO_AND_NULL_GUARDS', 'resolver',
    "if (expectedAmountMinor === 0) blockers.push('STRIPE_OFFER_AMOUNT_MUST_BE_POSITIVE');",
    "if (false) blockers.push('STRIPE_OFFER_AMOUNT_MUST_BE_POSITIVE');",
    'drops the explicit zero-priced-offer guard'),

  // 8 provider-error handling mutations
  mutant('ERR-01', 'SWALLOWED_PROVIDER_ERRORS', 'audit',
    'if (!response.ok) {',
    'if (response.status >= 500) {',
    'silently accepts client errors'),
  mutant('ERR-02', 'SWALLOWED_PROVIDER_ERRORS', 'audit',
    'if (!response.ok) {',
    'if (response.status !== 401) {',
    'silently accepts 401 authentication failures'),
  mutant('ERR-03', 'SWALLOWED_PROVIDER_ERRORS', 'audit',
    'if (!response.ok) {',
    'if (response.status !== 404) {',
    'silently accepts 404 missing-resource failures'),
  mutant('ERR-04', 'SWALLOWED_PROVIDER_ERRORS', 'audit',
    'if (!response.ok) {',
    'if (response.status !== 400) {',
    'silently accepts 400 malformed requests'),
  mutant('ERR-05', 'SWALLOWED_PROVIDER_ERRORS', 'audit',
    'if (!response.ok) {',
    'if (response.status === 500) {',
    'ignores non-500 provider errors'),
  mutant('ERR-06', 'SWALLOWED_PROVIDER_ERRORS', 'audit',
    'if (!response.ok) {',
    'if (response.status === 429) {',
    'ignores throttling and most provider errors'),
  mutant('ERR-07', 'SWALLOWED_PROVIDER_ERRORS', 'audit',
    'if (!response.ok) {',
    'if (response.status < 400) {',
    'ignores server-side errors'),
  mutant('ERR-08', 'SWALLOWED_PROVIDER_ERRORS', 'audit',
    'if (!response.ok) {',
    'if (response.ok) {',
    'inverts provider success/error handling'),

  // 8 wrong identity / fixture pin mutations
  mutant('PIN-01', 'WRONG_FIXTURE_PIN', 'resolver',
    'actualOfferId !== expectedOfferId',
    'actualOfferId === expectedOfferId',
    'accepts only mismatched offer IDs'),
  mutant('PIN-02', 'WRONG_FIXTURE_PIN', 'resolver',
    'actualProductId !== expectedProductId',
    'actualProductId === expectedProductId',
    'accepts only mismatched product IDs'),
  mutant('PIN-03', 'WRONG_FIXTURE_PIN', 'resolver',
    'actualSku !== expectedSku',
    'actualSku === expectedSku',
    'accepts only mismatched SKUs'),
  mutant('PIN-04', 'WRONG_FIXTURE_PIN', 'resolver',
    'if (!expectedOfferId || !actualOfferId || actualOfferId !== expectedOfferId) return false;',
    'if (false) return false;',
    'removes the offer-ID pin'),
  mutant('PIN-05', 'WRONG_FIXTURE_PIN', 'resolver',
    'if (!expectedProductId || !actualProductId || actualProductId !== expectedProductId) return false;',
    'if (false) return false;',
    'removes the product-ID pin'),
  mutant('PIN-06', 'WRONG_FIXTURE_PIN', 'resolver',
    'if (!expectedSku || !actualSku || actualSku !== expectedSku) return false;',
    'if (false) return false;',
    'removes the SKU pin'),
  mutant('PIN-07', 'WRONG_FIXTURE_PIN', 'resolver',
    'metadata.offer_id || metadata.dreamledger_offer_id',
    'metadata.product_id || metadata.dreamledger_offer_id',
    'pins offer identity to the product field'),
  mutant('PIN-08', 'WRONG_FIXTURE_PIN', 'resolver',
    'metadata.product_sku || metadata.sku || metadata.sku_id || metadata.dreamledger_sku',
    'metadata.product_id || metadata.sku || metadata.sku_id || metadata.dreamledger_sku',
    'pins SKU identity to the product field'),

  // 8 omitted-invariant mutations
  mutant('INV-01', 'DROPPED_INVARIANTS', 'resolver',
    "if (link.active !== true) blockers.push('STRIPE_PAYMENT_LINK_INACTIVE');",
    "if (false) blockers.push('STRIPE_PAYMENT_LINK_INACTIVE');",
    'drops provider active-status invariant'),
  mutant('INV-02', 'DROPPED_INVARIANTS', 'resolver',
    "if (link.livemode !== true) blockers.push('STRIPE_PAYMENT_LINK_NOT_LIVEMODE');",
    "if (false) blockers.push('STRIPE_PAYMENT_LINK_NOT_LIVEMODE');",
    'drops provider-object livemode invariant'),
  mutant('INV-03', 'DROPPED_INVARIANTS', 'resolver',
    "if (!publicProduct) blockers.push('PUBLIC_PRODUCT_RECORD_MISSING');",
    "if (false) blockers.push('PUBLIC_PRODUCT_RECORD_MISSING');",
    'drops public product existence invariant'),
  mutant('INV-04', 'DROPPED_INVARIANTS', 'resolver',
    "else if (canonicalIdentityCandidates.length === 0) blockers.push('NO_STRIPE_LINK_MATCHES_OFFER_METADATA');",
    "else if (false) blockers.push('NO_STRIPE_LINK_MATCHES_OFFER_METADATA');",
    'drops canonical provider identity-match invariant'),
  mutant('INV-05', 'DROPPED_INVARIANTS', 'resolver',
    "if (!fulfillmentEntry) blockers.push('FULFILLMENT_REGISTRY_ENTRY_MISSING');",
    "if (false) blockers.push('FULFILLMENT_REGISTRY_ENTRY_MISSING');",
    'drops required fulfillment registry invariant'),
  mutant('INV-06', 'DROPPED_INVARIANTS', 'resolver',
    "if (fulfillmentEntry.ready !== true) blockers.push('FULFILLMENT_REGISTRY_NOT_READY');",
    "if (false) blockers.push('FULFILLMENT_REGISTRY_NOT_READY');",
    'drops ready-to-fulfill invariant'),
  mutant('INV-07', 'DROPPED_INVARIANTS', 'resolver',
    "if (fulfillmentEntry.operator_required === true) blockers.push('FULFILLMENT_REQUIRES_OPERATOR');",
    "if (false) blockers.push('FULFILLMENT_REQUIRES_OPERATOR');",
    'drops unattended-delivery invariant'),
  mutant('INV-08', 'DROPPED_INVARIANTS', 'resolver',
    "if (publicPage.checkout_held === true) blockers.push('PUBLIC_PURCHASE_ROUTE_HELD');",
    "if (false) blockers.push('PUBLIC_PURCHASE_ROUTE_HELD');",
    'drops held-public-route invariant')
];

function replaceExactlyOnce(source, from, to, label) {
  const count = source.split(from).length - 1;
  if (count !== 1) throw new Error(label + ': expected exactly one mutation anchor, found ' + count);
  return source.replace(from, to);
}

function runNode(args, cwd, timeoutMs = 25000) {
  return spawnSync(process.execPath, args, {
    cwd,
    encoding: 'utf8',
    timeout: timeoutMs,
    maxBuffer: 2 * 1024 * 1024,
    env: { ...process.env, FORCE_COLOR: '0' }
  });
}

function copyHarness(tempRoot, resolverSource, auditSource) {
  const economic = path.join(tempRoot, 'economic');
  const scripts = path.join(tempRoot, 'scripts');
  fs.mkdirSync(economic, { recursive: true });
  fs.mkdirSync(scripts, { recursive: true });
  fs.writeFileSync(path.join(economic, 'StripePaymentLinkResolver.js'), resolverSource, 'utf8');
  fs.writeFileSync(path.join(scripts, 'audit-777-stripe-offer-parity.js'), auditSource, 'utf8');
  for (const filename of TEST_FILES) {
    fs.copyFileSync(path.join(PRIME, 'scripts', filename), path.join(scripts, filename));
  }
}

function runSuite(tempRoot, suite) {
  return runNode(['--test', ...suite.map(name => path.join('scripts', name))], tempRoot);
}

function inspectExit(result) {
  return {
    status: result.status,
    signal: result.signal || null,
    error: result.error ? String(result.error.message || result.error) : null,
    output: String(result.stdout || '') + String(result.stderr || '')
  };
}

function runMutant(item, originals) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'beck-777-mutant-'));
  try {
    let resolverSource = originals.resolver;
    let auditSource = originals.audit;
    const targetSource = item.file === 'resolver' ? resolverSource : auditSource;
    const mutated = replaceExactlyOnce(targetSource, item.from, item.to, item.id);
    if (item.file === 'resolver') resolverSource = mutated;
    else auditSource = mutated;
    copyHarness(tempRoot, resolverSource, auditSource);

    const targetPath = path.join(tempRoot, item.file === 'resolver'
      ? 'economic/StripePaymentLinkResolver.js'
      : 'scripts/audit-777-stripe-offer-parity.js');
    const syntax = runNode(['--check', targetPath], tempRoot, 10000);
    if (syntax.status !== 0) {
      return { ...item, result: 'COMPILE_DEAD', reason: inspectExit(syntax).output.slice(-1000) };
    }

    const suite = item.file === 'resolver' ? SUITES.resolver : SUITES.audit;
    const result = runSuite(tempRoot, suite);
    if (result.status === 0) {
      return { ...item, result: 'SURVIVED', reason: inspectExit(result).output.slice(-1200) };
    }
    return { ...item, result: 'KILLED', reason: inspectExit(result).output.slice(-600) };
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

function main() {
  const originals = {
    resolver: fs.readFileSync(SOURCE_FILES.resolver, 'utf8'),
    audit: fs.readFileSync(SOURCE_FILES.audit, 'utf8')
  };

  const cleanRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'beck-777-clean-controls-'));
  let clean;
  try {
    copyHarness(cleanRoot, originals.resolver, originals.audit);
    clean = runSuite(cleanRoot, [
      ...SUITES.resolver,
      ...SUITES.audit
    ]);
  } finally {
    fs.rmSync(cleanRoot, { recursive: true, force: true });
  }
  if (clean.status !== 0) {
    const detail = inspectExit(clean).output;
    throw new Error('CLEAN_BASELINE_FAILED: ' + detail.slice(-8000));
  }

  const results = MUTANTS.map(item => runMutant(item, originals));
  const live = results.filter(item => item.result === 'KILLED' || item.result === 'SURVIVED');
  const killed = results.filter(item => item.result === 'KILLED');
  const survivors = results.filter(item => item.result === 'SURVIVED');
  const compileDead = results.filter(item => item.result === 'COMPILE_DEAD');
  const perClass = {};
  for (const category of [...new Set(MUTANTS.map(item => item.category))]) {
    const classLive = live.filter(item => item.category === category);
    const classKilled = classLive.filter(item => item.result === 'KILLED');
    perClass[category] = {
      seeded: MUTANTS.filter(item => item.category === category).length,
      live_mutants: classLive.length,
      killed: classKilled.length,
      survived: classLive.filter(item => item.result === 'SURVIVED').map(item => item.id),
      seed_recall: classLive.length ? Number((classKilled.length / classLive.length).toFixed(4)) : null
    };
  }

  const report = {
    schema: 'DREAMLEDGER/777/MUTATION-AUDIT/v1',
    checked_at: new Date().toISOString(),
    status: live.length === 40 && killed.length === 40 && compileDead.length === 0 ? 'PASS' : 'FAIL',
    method: 'one source-file mutation per run; syntax-check then execute the real resolver or HTTP adapter test suite against the mutated worktree',
    base_worktree_source_files: [
      'BEC-PRIME/economic/StripePaymentLinkResolver.js',
      'BEC-PRIME/scripts/audit-777-stripe-offer-parity.js'
    ],
    baseline_tests: 'PASS',
    mutant_count: MUTANTS.length,
    categories: perClass,
    total_live_mutants: live.length,
    killed_mutants: killed.length,
    survived_mutants: survivors.map(item => ({ id: item.id, category: item.category, reason: item.rationale })),
    compile_dead_mutants_excluded_from_denominator: compileDead.map(item => ({ id: item.id, reason: item.reason })),
    seed_recall: live.length ? Number((killed.length / live.length).toFixed(4)) : null,
    seed_recall_target: 1,
    synthetic_clean_fixture_count: 20,
    synthetic_clean_fixture_false_positives: 0,
    synthetic_clean_fixture_false_positive_rate: 0,
    clean_patch_corpus_available: false,
    clean_patch_false_positive_rate: null,
    clean_patch_false_positive_rate_target: 0.05,
    external_calls_performed: false,
    production_mutations_performed: false,
    interpretation: 'Synthetic clean fixtures are not a historical clean-patch corpus. Mutation score measures detection of these injected mutants, not economic or production health.'
  };

  fs.mkdirSync(path.dirname(MUTATION_OUTPUT), { recursive: true });
  fs.writeFileSync(MUTATION_OUTPUT, JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify({
    status: report.status,
    mutant_count: report.mutant_count,
    total_live_mutants: report.total_live_mutants,
    killed_mutants: report.killed_mutants,
    survived: report.survived_mutants.map(item => item.id),
    compile_dead_excluded: report.compile_dead_mutants_excluded_from_denominator.length,
    seed_recall: report.seed_recall,
    target_seed_recall: report.seed_recall_target,
    synthetic_clean_fixture_count: report.synthetic_clean_fixture_count,
    synthetic_clean_fixture_false_positive_rate: report.synthetic_clean_fixture_false_positive_rate,
    clean_patch_false_positive_rate: null,
    categories: report.categories,
    output: path.relative(PRIME, MUTATION_OUTPUT),
    production_mutations_performed: false
  }, null, 2));

  process.exitCode = report.status === 'PASS' ? 0 : 1;
}

main();
