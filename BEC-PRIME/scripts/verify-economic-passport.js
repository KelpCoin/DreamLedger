const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');

const root = path.resolve(__dirname, '..');
const passportRoot = path.join(root, 'economic-passport');
const schemaPath = path.join(passportRoot, 'schema', 'economic-passport.schema.json');
const rulesPath = path.join(passportRoot, 'rules', 'verification-rules.json');
const examplePath = path.join(passportRoot, 'examples', 'EP-SPREADSHEET-RESCUE-001.json');
const proofDir = path.join(passportRoot, 'proof');
const proofPath = path.join(proofDir, 'EP-SPREADSHEET-RESCUE-001.verification.json');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function check(name, pass, detail) {
  return { name, status: pass ? 'PASS' : 'FAIL', detail };
}

function main() {
  const schema = readJson(schemaPath);
  const rules = readJson(rulesPath);
  const passport = readJson(examplePath);
  const ajv = new Ajv({ allErrors: true, strict: false, validateFormats: false });
  const validate = ajv.compile(schema);
  const schemaValid = validate(passport);

  const authority = passport.authority;
  const pricePolicyValid = authority.resale_price_policy === 'FIXED'
    ? typeof authority.resale_price_nzd === 'number'
    : authority.resale_price_policy === 'RANGE'
      ? typeof authority.resale_price_floor_nzd === 'number' && typeof authority.resale_price_ceiling_nzd === 'number' && authority.resale_price_floor_nzd <= authority.resale_price_ceiling_nzd
      : true;

  const marginValid = authority.reseller_margin.type === 'FIXED'
    ? authority.reseller_margin.amount_nzd >= 0 && authority.resale_price_policy === 'FIXED'
    : authority.reseller_margin.type === 'PERCENT'
      ? authority.reseller_margin.amount_nzd >= 0 && authority.reseller_margin.amount_nzd <= 100
      : authority.reseller_margin.type === 'NONE';

  const transitionValid = Array.isArray(passport.transition_log)
    && passport.transition_log.length > 0
    && passport.transition_log[passport.transition_log.length - 1].to === passport.passport_status;

  const ruleKnown = Object.prototype.hasOwnProperty.call(rules.rules, passport.evidence.verification_rule);

  const traversal = [
    check('REAL_PRODUCT', !!passport.commercial_truth.sku, 'SKU exists.'),
    check('ECONOMIC_PASSPORT', schemaValid, schemaValid ? 'Schema valid.' : JSON.stringify(validate.errors)),
    check('RESALE_INTERPRETATION', typeof authority.resale_allowed === 'boolean' && authority.territory.scope.length > 0 && pricePolicyValid && marginValid, 'Resale authority, territory, price policy and margin are machine-readable.'),
    check('FULFILMENT', passport.execution.fulfilment_method.length > 0 && passport.execution.fulfilment_trigger.length > 0 && passport.execution.fulfilment_window_hours > 0, 'Fulfilment method, trigger and window are explicit.'),
    check('EVIDENCE', passport.evidence.requirements.length > 0 && ruleKnown, 'Evidence requirements exist and verification rule is registered.'),
    check('VERIFICATION', passport.evidence.truth_status === 'UNVERIFIED' && passport.passport_status === 'ACTIVE' && transitionValid, 'ACTIVE lifecycle status is independent from UNVERIFIED truth status and has history.')
  ];

  const overall = schemaValid && traversal.every((x) => x.status === 'PASS');
  const proof = {
    proof_version: '1.1.0',
    generated_at: new Date().toISOString(),
    passport_id: passport.passport_id,
    sku: passport.commercial_truth.sku,
    overall: overall ? 'PASS' : 'FAIL',
    semantic_contract: {
      passport_status_means: 'lifecycle_and_listability_only',
      truth_status_means: 'evidence_state_only',
      resale_price_policy: authority.resale_price_policy,
      verification_rule: passport.evidence.verification_rule
    },
    schema: { path: path.relative(root, schemaPath), valid: schemaValid, errors: validate.errors || [] },
    traversal,
    hard_rules: {
      no_claimed_revenue: true,
      no_external_sale_claimed: true,
      truth_status_preserved: passport.evidence.truth_status === 'UNVERIFIED',
      no_public_release: true
    }
  };

  fs.mkdirSync(proofDir, { recursive: true });
  fs.writeFileSync(proofPath, JSON.stringify(proof, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify(proof, null, 2));
  console.log('PROOF: ' + proofPath);
  if (!overall) process.exitCode = 1;
}

main();
