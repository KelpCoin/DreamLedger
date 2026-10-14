#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '../..');
const BANK_PATH = path.join(__dirname, 'silo-definitions', 'ASYMMETRIC-LEVERAGE-1000.json');
const DEF_DIR = path.join(__dirname, 'silo-definitions', 'generated');
const TASK_DIR = path.join(__dirname, 'tasks', 'generated');
const MANIFEST_DIR = path.join(ROOT, 'runtime', 'cube', 'manifests');
const PROOF_DIR = path.join(ROOT, 'runtime', 'cube', 'seed-bank');
const PROOF_PATH = path.join(PROOF_DIR, 'ASYMMETRIC-LEVERAGE-1000-COMPILE-LATEST.json');
const CORE_SOURCE_PATHS = [
  'BEC-PRIME/NORTH-STAR.md',
  'BEC-PRIME/factory/FactoryFactoryOrchestrator.js',
  'BEC-PRIME/factory/UniversalFactoryCompiler.js',
  'BEC-PRIME/compiler/FactoryFactoryCompiler.js',
  'ops/cube-swarm/silo-definitions/mtg-commander.json',
  'public/catalog.json',
  'BEC-PRIME/lib/mtgDiagnosticFulfillment.js',
  'BEC-PRIME/routes/mtgDiagnostic.js'
];

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}
function writeJsonAtomic(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp-' + process.pid;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n', 'utf8');
  fs.rmSync(file, { force: true });
  fs.renameSync(tmp, file);
}
function readSources() {
  const out = {};
  for (const relative of CORE_SOURCE_PATHS) {
    const full = path.resolve(ROOT, relative);
    if (!full.startsWith(ROOT + path.sep) || !fs.existsSync(full) || !fs.statSync(full).isFile()) {
      out[relative] = { status: 'SOURCE_MISSING', sha256: null };
      continue;
    }
    out[relative] = { status: 'SOURCE_PRESENT', sha256: sha256(fs.readFileSync(full)) };
  }
  const missing = Object.entries(out).filter(([, value]) => value.status !== 'SOURCE_PRESENT').map(([key]) => key);
  if (missing.length) throw new Error('CORE_SOURCE_FILES_MISSING: ' + missing.join(','));
  return out;
}
function validateBank(bank) {
  if (!bank || bank.schema_version !== 'dreamledger/cube-swarm-asymmetric-leverage-seed-bank/v1') {
    throw new Error('UNSUPPORTED_SEED_BANK_SCHEMA');
  }
  if (!Array.isArray(bank.domains) || bank.domains.length !== 40 ||
      !Array.isArray(bank.mechanisms) || bank.mechanisms.length !== 25 ||
      !Array.isArray(bank.candidates) || bank.candidates.length !== 1000) {
    throw new Error('BANK_DIMENSIONS_MUST_BE_40_X_25');
  }
  const domains = new Map(bank.domains.map(x => [x.id, x]));
  const mechanisms = new Map(bank.mechanisms.map(x => [x.id, x]));
  const ids = new Set(), skus = new Set();
  for (const item of bank.candidates) {
    if (!item || !domains.has(item.domain_id) || !mechanisms.has(item.mechanism_id) ||
        !item.silo_id || !item.sku || !item.seed_id) throw new Error('INVALID_CANDIDATE_REFERENCE');
    if (ids.has(item.silo_id)) throw new Error('DUPLICATE_SILO_ID: ' + item.silo_id);
    if (skus.has(item.sku)) throw new Error('DUPLICATE_SKU: ' + item.sku);
    ids.add(item.silo_id); skus.add(item.sku);
  }
  if (ids.size !== 1000 || skus.size !== 1000) throw new Error('UNIQUENESS_VALIDATION_FAILED');
  return { domains, mechanisms, ids, skus };
}
function resetOwnedOutputs() {
  for (const dir of [DEF_DIR, TASK_DIR]) {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.mkdirSync(MANIFEST_DIR, { recursive: true });
  for (const name of fs.readdirSync(MANIFEST_DIR)) {
    if (name.startsWith('cube-seed-') && name.endsWith('.json')) {
      fs.rmSync(path.join(MANIFEST_DIR, name), { force: true });
    }
  }
}
function compile(bank, sources) {
  const refs = validateBank(bank);
  resetOwnedOutputs();
  const outputs = { definitions: 0, tasks: 0, manifests: 0, fit_review_required: 0 };
  const summary = [];

  for (const item of bank.candidates) {
    const domain = refs.domains.get(item.domain_id);
    const mechanism = refs.mechanisms.get(item.mechanism_id);
    const slug = item.silo_id;
    const price = Number(mechanism.price_nzd_hypothesis);
    const model = mechanism.pricing_model;
    const name = domain.name + ': ' + mechanism.name;
    const evidence = bank.source_refs.map(relative => ({
      path: relative,
      status: sources[relative]?.status || 'SOURCE_NOT_HASHED',
      sha256: sources[relative]?.sha256 || null,
      meaning: 'reusable implementation reference; not market-demand evidence'
    }));
    if (evidence.some(x => x.status !== 'SOURCE_PRESENT' || !x.sha256)) {
      throw new Error('SOURCE_EVIDENCE_INCOMPLETE: ' + slug);
    }
    const taskId = 'BUILD-CANDIDATE-' + slug.toUpperCase();

    const definition = {
      schema_version: 'dreamledger/cube-swarm-silo-definition/v1',
      silo_id: slug,
      seed_id: item.seed_id,
      name,
      category: domain.category,
      lifecycle: 'CANDIDATE',
      asymmetric_leverage_score: item.fit_score,
      score_interpretation: bank.scoring_doctrine,
      buyer_class: domain.buyer,
      operational_friction_hypothesis: domain.problem,
      demand_hypothesis: domain.buyer + ' may pay for ' + mechanism.name.toLowerCase() +
        ' if it measurably reduces this workflow friction. This is an unvalidated hypothesis.',
      product_mechanism: mechanism,
      commercial_contract: {
        sku: item.sku,
        currency: 'NZD',
        amount_minor: price * 100,
        price_nzd_hypothesis: price,
        pricing_model: model,
        checkout_status: 'NOT_CONFIGURED_NO_CHECKOUT',
        checkout_url: null,
        stripe_product_id: null,
        stripe_price_id: null,
        evidence_required: [
          'independent_external_buyer', 'stripe_livemode_settled_payment',
          'sku_price_currency_mode_match', 'correct_order_attribution',
          'fulfillment_artifact_sha256', 'delivery_confirmed', 'independent_provider_evidence'
        ]
      },
      candidate_catalog_entry: {
        id: item.sku,
        sku: item.sku,
        name,
        description: mechanism.method,
        price,
        currency: 'nzd',
        billing_interval: model === 'MONTHLY' ? 'month' : null,
        status: 'draft',
        checkout_available: false,
        checkout_url: null,
        category: domain.category,
        availability: 'not_available',
        commercial_validation_status: 'UNVALIDATED'
      },
      fulfillment_contract: {
        buyer_input: 'Operator-authorized data and a bounded statement of scope only.',
        deliverable: mechanism.deliverable,
        method: mechanism.method,
        boundary: 'Candidate-only. Unknown or contradictory facts remain UNKNOWN.',
        delivery_proof: ['artifact_sha256', 'order_to_artifact_attribution', 'delivery_receipt', 'fulfillment_timestamp_utc']
      },
      acquisition_hypothesis: {
        surfaces: domain.channels,
        mode: 'INBOUND_OR_OPT_IN_ONLY',
        public_publication_allowed: false,
        outbound_contact_allowed: false,
        paid_acquisition_allowed: false,
        first_test: 'Run internal fixtures or operator-authorized sample data first; external demand tests require separate approval.'
      },
      gauntlet: {
        fit_score: item.fit_score,
        fit_review_required: item.fit_review_required,
        market_validation_status: 'UNVALIDATED',
        required_checks: ['buyer pain specificity', 'source access and terms', 'deterministic fulfillment', 'marginal support load', 'willingness to pay', 'privacy and risk review'],
        kill_conditions: ['no evidenced recurring pain', 'source access unavailable or disallowed', 'no deterministic deliverable', 'support burden exceeds price', 'unsupported claims required']
      },
      implementation_contract: {
        status: 'SPECIFIED_NOT_IMPLEMENTED',
        library_path: 'BEC-PRIME/lib/' + slug + 'Fulfillment.js',
        route_handler_path: 'BEC-PRIME/routes/' + slug + '.js',
        supabase_function_path: 'supabase/functions/silo-' + slug + '/index.ts',
        task_contract_path: 'ops/cube-swarm/tasks/generated/' + slug + '.json',
        lane_manifest_path: 'runtime/cube/manifests/cube-seed-' + slug + '.json',
        cube_factory_intake: 'BEC-PRIME/compiler/FactoryFactoryCompiler.js::readLaneManifests',
        north_star_selector_status: 'NOT_WIRED_TO_NORTH_STAR_SELECTOR',
        checkout_creation_allowed: false,
        public_catalogue_mutation_allowed: false,
        deployment_allowed: false
      },
      source_refs: bank.source_refs,
      source_evidence: evidence,
      idea_heritage: bank.conversation_heritage,
      isolation: {
        compute: 'SHARED_WORKER_CANDIDATE',
        database_strategy: 'UNSELECTED_NO_DATABASE_PROVISIONED',
        database_name: null,
        database_id: null,
        cross_silo_customer_data: false
      },
      routes: ['/candidates/' + slug + '/', '/candidates/' + slug + '/input/', '/api/candidates/' + slug + '/input'],
      provisioning: {
        mode: 'DRY_RUN_ONLY',
        deploy_allowed: false,
        reason: 'Candidate-only; demand, checkout, fulfillment and deployment are unverified.'
      },
      economics: {
        price_nzd_hypothesis: price,
        unit_economics_status: 'UNVALIDATED',
        verified_revenue_nzd: 0,
        spend_allowed_without_authorization: false
      },
      proof_contract: {
        required: ['external_buyer', 'settled_payment', 'correct_attribution', 'fulfillment', 'independent_proof'],
        revenue_state: 'UNVERIFIED'
      }
    };
    writeJsonAtomic(path.join(DEF_DIR, slug + '.json'), definition);
    outputs.definitions++;

    const task = {
      schema_version: 'dreamledger/cube-swarm-task-contract/v1',
      task_id: taskId,
      worker_preference: 'multi_model_diverse',
      lifecycle: 'CANDIDATE_INTERNAL_BUILD',
      runtime_consumption_status: 'GENERATED_FOR_FACTORY_QUEUE_NOT_NORTH_STAR_SELECTOR',
      target_silo_id: slug,
      task: 'Create a source-backed internal implementation plan and deterministic test harness for ' + name + '. Do not launch or publish.',
      inputs: {
        starting_sources: bank.source_refs,
        source_evidence: evidence,
        candidate_definition_path: 'ops/cube-swarm/silo-definitions/generated/' + slug + '.json',
        does_not_prove: ['buyer demand', 'willingness to pay', 'checkout readiness', 'settlement', 'fulfillment', 'profitability', 'revenue']
      },
      required_artifact: {
        path: 'ops/cube-swarm/build-plans/' + slug + '.json',
        format: 'JSON',
        required_fields: ['source_evidence', 'source_sha256', 'implementation_plan', 'tests', 'blockers', 'decision', 'human_gate']
      },
      success_criteria: [
        'Hash declared source files and record actual present/missing status.',
        'Use synthetic or operator-authorized fixtures only.',
        'Keep checkout, public publication, deployment, and external effects disabled.',
        'Produce implementation gaps, deterministic tests, and explicit kill criteria.',
        'Do not claim demand, settlement, fulfillment, profit, or revenue.'
      ],
      guardrails: {
        external_action_performed: false,
        external_commercial_action_performed: false,
        production_mutation_performed: false,
        database_write_performed: false,
        payment_verified: false,
        fulfillment_verified: false,
        checkout_creation_allowed: false,
        deployment_allowed: false,
        public_publication_allowed: false,
        verified_revenue_nzd: 0
      },
      human_gate: true
    };
    writeJsonAtomic(path.join(TASK_DIR, slug + '.json'), task);
    outputs.tasks++;

    const manifest = {
      schema_version: 'dreamledger/cube-swarm-lane-manifest/v1',
      candidate_id: slug,
      silo_id: slug,
      substrate_type: domain.category,
      demand_family: 'operator_workflow_friction',
      transformation: {
        name,
        id: mechanism.id,
        deliverable: mechanism.deliverable,
        source_refs: bank.source_refs
      },
      commercial_boundary: { price_nzd: price, currency: 'NZD', pricing_model: model, status: 'HYPOTHESIS_ONLY' },
      buyer_output: {
        format: 'source-backed candidate deliverable',
        contains: ['source refs', 'source SHA-256 values', 'missing-evidence flags', 'implementation plan', 'tests', 'kill criteria']
      },
      commerce_path: {
        checkout: 'NOT_CONFIGURED_NO_CHECKOUT',
        fulfillment: mechanism.deliverable,
        proof: 'settled payment + correct attribution + artifact SHA-256 + delivery receipt + independent provider evidence'
      },
      kill_criteria: definition.gauntlet.kill_conditions,
      provenance: {
        source: 'ops/cube-swarm/silo-definitions/ASYMMETRIC-LEVERAGE-1000.json',
        seed_id: item.seed_id,
        source_refs: bank.source_refs,
        source_hashes: evidence.map(x => ({ path: x.path, sha256: x.sha256 })),
        market_demand_proven: false
      },
      authority: {
        publication: 'APPROVAL_REQUIRED',
        outreach: 'APPROVAL_REQUIRED',
        spend: 'APPROVAL_REQUIRED',
        charge: 'APPROVAL_REQUIRED',
        production_mutation: 'APPROVAL_REQUIRED'
      },
      state: item.fit_review_required ? 'FIT_REVIEW_REQUIRED' : 'READY_FOR_GAUNTLET_NOT_LAUNCH'
    };
    writeJsonAtomic(path.join(MANIFEST_DIR, 'cube-seed-' + slug + '.json'), manifest);
    outputs.manifests++;
    if (item.fit_review_required) outputs.fit_review_required++;
    summary.push({ seed_id: item.seed_id, silo_id: slug, fit_score: item.fit_score, fit_review_required: item.fit_review_required, price_nzd_hypothesis: price, pricing_model: model });
  }

  const proof = {
    schema_version: 'dreamledger/cube-swarm-asymmetric-leverage-compilation-proof/v1',
    generated_at_utc: new Date().toISOString(),
    seed_bank_path: path.relative(ROOT, BANK_PATH).replace(/\\/g, '/'),
    seed_bank_sha256: sha256(fs.readFileSync(BANK_PATH)),
    source_evidence: Object.entries(sources).map(([sourcePath, value]) => ({ path: sourcePath, ...value })),
    candidate_count: bank.candidates.length,
    unique_silo_ids: bank.candidates.length,
    unique_sku_hypotheses: bank.candidates.length,
    generated_outputs: outputs,
    cube_factory_intake: 'BEC-PRIME/compiler/FactoryFactoryCompiler.js::readLaneManifests',
    checkout_configured: false,
    public_catalogue_changed: false,
    deployment_performed: false,
    external_action_performed: false,
    verified_revenue_nzd: 0,
    candidates: summary
  };
  writeJsonAtomic(PROOF_PATH, proof);
  return proof;
}
function main() {
  const bank = JSON.parse(fs.readFileSync(BANK_PATH, 'utf8'));
  const validated = validateBank(bank);
  if (process.argv.includes('--self-test')) {
    if (validated.ids.size !== 1000 || validated.skus.size !== 1000) throw new Error('SEED_BANK_SELF_TEST_FAILED');
    console.log('ASYMMETRIC_LEVERAGE_1000_SELF_TEST=PASS');
    return;
  }
  const sources = readSources();
  const proof = compile(bank, sources);
  console.log(JSON.stringify({
    status: 'PASS_INTERNAL_CANDIDATE_COMPILATION',
    candidates: proof.candidate_count,
    generated_definitions: proof.generated_outputs.definitions,
    generated_tasks: proof.generated_outputs.tasks,
    generated_cube_lane_manifests: proof.generated_outputs.manifests,
    fit_review_required: proof.generated_outputs.fit_review_required,
    source_files_hashed: proof.source_evidence.length,
    seed_bank_sha256: proof.seed_bank_sha256,
    proof_path: PROOF_PATH,
    public_catalogue_changed: false,
    checkout_configured: false,
    deployment_performed: false,
    external_action_performed: false,
    verified_revenue_nzd: 0
  }, null, 2));
}
if (require.main === module) main();
module.exports = { compile, readSources, validateBank };
