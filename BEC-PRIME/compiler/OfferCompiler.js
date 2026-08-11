const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Ajv = require('ajv');

const ROOT = path.join(__dirname, '..');
const CAPABILITIES_PATH = path.join(ROOT, 'catalog', 'ip-capabilities.json');
const OFFERS_DIR = path.join(ROOT, 'catalog', 'offers');
const CANDIDATES_FILE = path.join(OFFERS_DIR, 'candidates.json');
const OFFERS_FILE = path.join(OFFERS_DIR, 'offers.json');
const PROOF_FILE = path.join(ROOT, 'PROOF-OFFER-COMPILATION.json');
const SCHEMA_PATH = path.join(__dirname, 'schemas', 'offer.schema.json');
const OFFER_VERSION = 'offer-compiler-v1';

const offerSchema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
const ajv = new Ajv({ allErrors: true, strict: false });
const validateOffer = ajv.compile(offerSchema);

function loadCapabilities() {
  const catalog = JSON.parse(fs.readFileSync(CAPABILITIES_PATH, 'utf8'));
  if (!Array.isArray(catalog.capabilities)) throw new Error('Invalid IP capability catalog: capabilities[] required');
  return catalog.capabilities;
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function hashFile(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function eligibility(capability) {
  for (const field of ['id', 'name', 'summary', 'commercialization', 'silo']) {
    if (!capability || !String(capability[field] || '').trim()) return { eligible: false, reason: `missing_${field}` };
  }
  return { eligible: true };
}

function buildOffer(capability, type, price, output, buyer, problem, pricing = {}) {
  const offerType = type.replace(/_/g, ' ');
  const offerId = `OFFER-${slug(capability.id)}-${slug(type)}`.toUpperCase();
  return {
    offer_id: offerId,
    version: 'offer-v1',
    capability_id: capability.id,
    silo: capability.silo,
    name: `${capability.name} ${offerType}`,
    problem,
    input: 'Customer-provided context, constraints, and relevant artifacts required for the selected service.',
    output,
    delivery_mechanism: 'engine_generated_digital_deliverable',
    deliverable: output,
    target_buyer: buyer,
    eligibility: 'Customer must provide sufficient inputs; final scope is confirmed before fulfillment.',
    constraints: ['No credential collection', 'No private conversation publication', 'No unsupported claims', 'Silo boundaries enforced'],
    price,
    currency: 'NZD',
    pricing_strategy: pricing.strategy || 'fixed',
    pricing_tier: pricing.tier || null,
    refund_rules: 'Apply the published checkout policy; delivery is not represented as complete before verified fulfillment.',
    payment_adapter: 'stripe',
    checkout_route: '/api/offer-checkout/create',
    approval_required: true,
    checkout_available: false,
    status: 'candidate',
    proof_of_delivery: 'durable_delivery_record_plus_transaction_proof',
    verification_rules: [
      'capability_exists', 'required_offer_fields', 'price_positive', 'approval_gate_locked',
      'no_private_ip_exposure', 'no_unsupported_claims', 'delivery_defined', 'payment_defined',
      'proof_defined', 'silo_isolated', 'schema_valid', 'unique_offer_id'
    ],
    provenance: {
      capability_ids: [capability.id],
      methodology: OFFER_VERSION,
      public_claims_source: 'BEC-PRIME/catalog/ip-capabilities.json',
      private_material: 'excluded'
    }
  };
}

function buildTierOffer(capability, tier, buyer) {
  const type = tier.deliverable;
  const copy = {
    snapshot: {
      output: '0-100 readiness score, five-dimension summary, top three revenue-impacting blockers, and evidence-backed next actions.',
      problem: 'Identify the highest-impact barriers preventing a merchant from being discoverable, understandable, and transactable by commerce agents.'
    },
    full_audit: {
      output: 'Full readiness score, evidence pack, ranked remediation backlog, and revenue-impact prioritization.',
      problem: 'Turn agent-commerce readiness gaps into an evidence-backed remediation plan ranked by likely commercial impact.'
    },
    blueprint: {
      output: 'Full audit plus implementation specification covering structured data, catalog/feed surfaces, agent discoverability, checkout readiness, and remediation sequencing.',
      problem: 'Convert readiness findings into an implementation-ready blueprint that an engineering or commerce team can execute.'
    }
  }[type] || {
    output: `${capability.name} ${String(type).replace(/_/g, ' ')} deliverable with findings, evidence, and prioritized next actions.`,
    problem: `Assess and improve the area described by ${capability.name}.`
  };

  return buildOffer(capability, type, tier.price, copy.output, buyer, copy.problem, {
    strategy: 'tiered',
    tier: type
  });
}

function generateCandidates(capabilities) {
  const candidates = [];
  const rejected = [];
  for (const capability of capabilities) {
    const check = eligibility(capability);
    if (!check.eligible) {
      rejected.push({ capability_id: capability?.id || null, reason: check.reason });
      continue;
    }

    const buyer = ['commerce', 'agentic_commerce', 'audit'].includes(capability.category)
      ? 'Teams preparing products or services for machine-readable commerce'
      : 'Operators and teams needing structured assessment of systems, verification, architecture, or monetization';

    if (capability.pricing_strategy === 'tiered') {
      if (!Array.isArray(capability.tiers) || capability.tiers.length === 0) {
        rejected.push({ capability_id: capability.id, reason: 'tiered_pricing_requires_tiers' });
        continue;
      }
      for (const tier of capability.tiers) {
        if (!tier || typeof tier.price !== 'number' || tier.price <= 0 || !String(tier.deliverable || '').trim()) {
          rejected.push({ capability_id: capability.id, reason: 'invalid_pricing_tier', tier });
          continue;
        }
        candidates.push(buildTierOffer(capability, tier, buyer));
      }
      continue;
    }

    candidates.push(buildOffer(
      capability, 'diagnostic', 15,
      'Structured diagnostic report with findings, prioritized recommendations, and explicit next actions.',
      buyer, capability.summary
    ));
    candidates.push(buildOffer(
      capability, 'audit', 49,
      'Detailed audit report with evidence map, prioritized remediation plan, and implementation roadmap.',
      buyer, `Assess and improve the area described by ${capability.name}.`
    ));
  }
  return { candidates, rejected };
}

function runGauntlet(candidates, capabilities) {
  const byId = new Map(capabilities.map(c => [c.id, c]));
  const seen = new Set();
  const passed = [];
  const rejected = [];
  const privateTerms = /(?:credential|password|private[_ -]?key|secret|api[_ -]?key)/i;
  const required = [
    'offer_id', 'version', 'capability_id', 'silo', 'name', 'problem', 'input', 'output',
    'delivery_mechanism', 'deliverable', 'target_buyer', 'eligibility', 'constraints',
    'price', 'currency', 'refund_rules', 'payment_adapter', 'checkout_route',
    'approval_required', 'checkout_available', 'status', 'proof_of_delivery',
    'verification_rules', 'provenance'
  ];

  for (const candidate of candidates) {
    const errors = [];
    const capability = byId.get(candidate.capability_id);
    for (const field of required) {
      if (candidate[field] === undefined || candidate[field] === null || candidate[field] === '') errors.push(`missing:${field}`);
    }
    if (!capability) errors.push('unknown_capability');
    if (capability && candidate.silo !== capability.silo) errors.push('silo_mismatch');
    if (typeof candidate.price !== 'number' || candidate.price <= 0) errors.push('invalid_price');
    if (candidate.currency !== 'NZD') errors.push('unsupported_currency');
    if (candidate.approval_required !== true) errors.push('approval_gate_not_locked');
    if (candidate.checkout_available !== false) errors.push('checkout_must_start_disabled');
    if (candidate.status !== 'candidate') errors.push('candidate_status_required');
    if (seen.has(candidate.offer_id)) errors.push('duplicate_offer_id');
    if (privateTerms.test(`${candidate.name} ${candidate.problem} ${candidate.output}`)) errors.push('potential_private_material_reference');
    if (candidate.provenance?.private_material !== 'excluded') errors.push('private_material_not_excluded');
    if (!validateOffer(candidate)) errors.push(...(validateOffer.errors || []).map(e => `schema:${e.instancePath || '/'}:${e.message}`));

    if (errors.length) rejected.push({ candidate, errors });
    else {
      seen.add(candidate.offer_id);
      passed.push(candidate);
    }
  }
  return { passed, rejected };
}

function byCapability(capabilities, id) {
  return capabilities.find(c => c.id === id);
}

function compile() {
  const capabilities = loadCapabilities();
  const generated = generateCandidates(capabilities);
  const gauntlet = runGauntlet(generated.candidates, capabilities);
  fs.mkdirSync(OFFERS_DIR, { recursive: true });
  const allRejected = [...generated.rejected, ...gauntlet.rejected];
  const deterministicManifest = {
    schema: 'BEC-PRIME/OFFER-CATALOG/v1',
    compiler: OFFER_VERSION,
    source: 'catalog/ip-capabilities.json',
    approval_rule: 'All compiled offers remain approval-gated and checkout-disabled until explicitly approved.',
    counts: {
      capabilities: capabilities.length,
      candidates: generated.candidates.length,
      passed: gauntlet.passed.length,
      rejected: allRejected.length
    }
  };
  fs.writeFileSync(CANDIDATES_FILE, JSON.stringify({ ...deterministicManifest, candidates: generated.candidates, rejected: allRejected }, null, 2) + '\n');
  fs.writeFileSync(OFFERS_FILE, JSON.stringify({ ...deterministicManifest, offers: gauntlet.passed }, null, 2) + '\n');

  // Keep proof deterministic. Runtime timestamps and triggering commit SHAs
  // do not describe the compiled offer set and previously caused CI churn.
  const inputHash = hashFile(CAPABILITIES_PATH);
  const proof = {
    type: 'dreamledger-offer-compilation-proof',
    status: gauntlet.passed.length === generated.candidates.length && allRejected.length === 0 ? 'PASS' : 'PARTIAL',
    compiler: OFFER_VERSION,
    generated_at: null,
    git_commit: null,
    input_capabilities_sha256: inputHash,
    source: 'catalog/ip-capabilities.json',
    schema: 'compiler/schemas/offer.schema.json',
    counts: deterministicManifest.counts,
    passed_offer_ids: gauntlet.passed.map(o => o.offer_id),
    rejected_offer_ids: allRejected.map(item => item.candidate?.offer_id || item.capability_id || null),
    approval_required_for_all: gauntlet.passed.every(o => o.approval_required === true),
    checkout_disabled_for_all: gauntlet.passed.every(o => o.checkout_available === false),
    silo_integrity: gauntlet.passed.every(o => byCapability(capabilities, o.capability_id)?.silo === o.silo),
    deterministic_ids: new Set(gauntlet.passed.map(o => o.offer_id)).size === gauntlet.passed.length,
    deterministic_proof: true
  };
  fs.writeFileSync(PROOF_FILE, JSON.stringify(proof, null, 2) + '\n');
  return { ...deterministicManifest, candidates: generated.candidates, passed: gauntlet.passed, rejected: allRejected };
}

module.exports = { compile, loadCapabilities, generateCandidates, runGauntlet, eligibility };

if (require.main === module) {
  const result = compile();
  console.log(JSON.stringify({ compiler: OFFER_VERSION, capabilities: result.counts.capabilities, candidates: result.counts.candidates, passed: result.counts.passed, rejected: result.counts.rejected }, null, 2));
}
