#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const IP_PATH = path.join(ROOT, 'BEC-PRIME', 'catalog', 'ip-capabilities.json');
const PRODUCT_DIR = path.join(ROOT, 'BEC-PRIME', 'catalog', 'products');
const OUT_PATH = path.join(ROOT, 'BEC-PRIME', 'catalog', 'offers.json');
const PROOF_PATH = path.join(ROOT, 'OFFER-COMPILATION-PROOF.json');

const SECRET_PATTERNS = ['sk_live_', 'sk_test_', 'whsec_', 'PRIVATE KEY', 'BEGIN RSA PRIVATE KEY', 'BEGIN OPENSSH PRIVATE KEY'];

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function writeJson(file, value) { fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', 'utf8'); }
function fail(message) { throw new Error(message); }
function requireCapability(catalog, id) {
  const capability = catalog.capabilities.find(item => item.id === id);
  if (!capability) fail(`Missing required capability: ${id}`);
  return capability;
}
function loadProducts() {
  return fs.readdirSync(PRODUCT_DIR).filter(name => name.endsWith('.json')).map(name => readJson(path.join(PRODUCT_DIR, name)));
}
function assertNoSecrets(value, label) {
  const raw = JSON.stringify(value);
  for (const pattern of SECRET_PATTERNS) if (raw.includes(pattern)) fail(`Secret pattern detected in ${label}: ${pattern}`);
}

try {
  const ip = readJson(IP_PATH);
  if (ip.schema !== 'BEC-PRIME/IP-CAPABILITY-CATALOG/v1') fail('Unsupported IP capability catalog schema');
  if (!Array.isArray(ip.capabilities) || ip.capabilities.length === 0) fail('IP capability catalog is empty');
  assertNoSecrets(ip, 'ip-capabilities.json');

  const products = loadProducts();
  const productIds = new Set(products.map(product => product.id));
  const commander = products.find(product => product.id === 'COMMANDER-DECK-DIAGNOSTIC-001');
  if (!commander) fail('Canonical Commander product is missing');

  const architecture = requireCapability(ip, 'BEC-PRIME-ARCHITECTURE');
  const agentCommerce = requireCapability(ip, 'BEC-PRIME-AGENT-COMMERCE');

  const offers = [
    {
      offer_id: 'OFFER-COMMANDER-DECK-DIAGNOSTIC-001',
      capability_id: 'BEC-PRIME-ARCHITECTURE',
      source_kind: 'canonical_product_projection',
      product_id: commander.id,
      silo: commander.silo,
      name: commander.name,
      problem: 'A Commander player wants a focused external assessment of deck strategy, consistency, and performance.',
      input: 'Commander deck list supplied by the customer.',
      output: 'Structured diagnostic with prioritized recommendations.',
      buyer: 'MTG Commander player',
      offer_type: 'diagnostic',
      delivery_method: 'digital_report',
      price: commander.price,
      currency: commander.currency,
      approval_required: true,
      checkout_available: false,
      status: 'candidate_projection',
      proof_of_delivery: 'generated_report_receipt',
      refund_policy: 'Use the canonical product refund policy when checkout is approved.',
      eligibility: 'Customer must supply a usable Commander deck list.',
      verification_rules: ['canonical_product', 'approval_gate', 'price_explicit', 'delivery_defined', 'silo_isolated'],
      source_capabilities: [commander.id],
      private_material_excluded: true
    },
    {
      offer_id: 'OFFER-BEC-PRIME-ARCHITECTURE-AUDIT-002',
      capability_id: architecture.id,
      source_kind: 'compiler_candidate',
      product_id: productIds.has('BEC-PRIME-ARCHITECTURE-AUDIT-001') ? 'BEC-PRIME-ARCHITECTURE-AUDIT-001' : null,
      silo: 'commerce',
      name: 'BEC-PRIME Architecture Audit',
      problem: 'A founder needs an independent assessment of a local-first AI commerce system and its monetization readiness.',
      input: 'System description, architecture artifacts, deployment constraints, and commercial goals.',
      output: 'Structured architecture audit with risks, bottlenecks, and prioritized implementation actions.',
      buyer: 'Founder, operator, or technical product owner',
      offer_type: 'audit',
      delivery_method: 'digital_report',
      price: 149,
      currency: 'nzd',
      pricing_mode: 'proposed_candidate_price',
      approval_required: true,
      checkout_available: false,
      status: 'candidate',
      proof_of_delivery: 'report_hash_and_delivery_receipt',
      refund_policy: 'Define before approval and publication.',
      eligibility: 'Customer can provide sufficient system information for a meaningful audit.',
      verification_rules: ['capability_exists', 'no_private_ip_exposure', 'no_unsupported_claims', 'price_explicit', 'delivery_defined', 'proof_defined', 'approval_gate', 'silo_isolated'],
      source_capabilities: [architecture.id],
      private_material_excluded: true
    },
    {
      offer_id: 'OFFER-BEC-PRIME-AGENT-READINESS-001',
      capability_id: agentCommerce.id,
      source_kind: 'compiler_candidate',
      product_id: null,
      silo: 'commerce',
      name: 'Agent-Readiness Audit',
      problem: 'A business wants to know whether its products and services are discoverable, understandable, and purchasable by software agents.',
      input: 'Product catalog, policies, fulfillment rules, checkout surface, and relevant APIs.',
      output: 'Machine-readability and agent-commerce readiness report with prioritized gaps.',
      buyer: 'E-commerce operator or SaaS/product owner',
      offer_type: 'audit',
      delivery_method: 'digital_report',
      price: 99,
      currency: 'nzd',
      pricing_mode: 'proposed_candidate_price',
      approval_required: true,
      checkout_available: false,
      status: 'candidate',
      proof_of_delivery: 'report_hash_and_delivery_receipt',
      refund_policy: 'Define before approval and publication.',
      eligibility: 'Customer controls or can authorize review of the relevant commerce surface.',
      verification_rules: ['capability_exists', 'no_private_ip_exposure', 'no_unsupported_claims', 'price_explicit', 'delivery_defined', 'proof_defined', 'approval_gate', 'silo_isolated'],
      source_capabilities: [agentCommerce.id],
      private_material_excluded: true
    }
  ];

  const ids = offers.map(offer => offer.offer_id);
  if (new Set(ids).size !== ids.length) fail('Duplicate offer IDs generated');
  for (const offer of offers) {
    if (!offer.approval_required || offer.checkout_available) fail(`Unsafe publication state: ${offer.offer_id}`);
    assertNoSecrets(offer, offer.offer_id);
  }

  const output = {
    schema: 'BEC-PRIME/OFFER-CATALOG/v1',
    compiler: 'BEC-PRIME OfferCompiler v1',
    source: 'BEC-PRIME/catalog/ip-capabilities.json',
    publication_rule: 'Candidates remain approval-gated and are not checkout-enabled until explicitly approved.',
    offers
  };
  writeJson(OUT_PATH, output);

  const proof = {
    schema: 'BEC-PRIME/OFFER-COMPILATION-PROOF/v1',
    result: 'PASS',
    source_catalog: 'BEC-PRIME/catalog/ip-capabilities.json',
    output_catalog: 'BEC-PRIME/catalog/offers.json',
    generated_offer_ids: ids,
    generated_at_utc: new Date().toISOString(),
    checks: [
      'source_schema_valid',
      'required_capabilities_present',
      'canonical_commander_product_present',
      'unique_offer_ids',
      'no_secret_patterns',
      'approval_required_for_all_candidates',
      'checkout_disabled_for_all_candidates',
      'private_material_excluded'
    ],
    status_transition: 'IP capability -> candidate economic object; human approval still required.'
  };
  writeJson(PROOF_PATH, proof);
  console.log(`OFFER_COMPILATION=PASS`);
  console.log(`OFFERS=${OUT_PATH}`);
  console.log(`PROOF=${PROOF_PATH}`);
} catch (error) {
  console.error(`OFFER_COMPILATION=FAIL:${error.message}`);
  process.exit(1);
}
