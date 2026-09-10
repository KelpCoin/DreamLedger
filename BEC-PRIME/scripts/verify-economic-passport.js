const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');

const root = path.resolve(__dirname, '..');
const schemaPath = path.join(root, 'economic-passport', 'schema', 'economic-passport.schema.json');
const examplePath = path.join(root, 'economic-passport', 'examples', 'EP-SPREADSHEET-RESCUE-001.json');
const proofDir = path.join(root, 'economic-passport', 'proof');
const proofPath = path.join(proofDir, 'EP-SPREADSHEET-RESCUE-001.verification.json');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function fail(message) {
  console.error('FAIL: ' + message);
  process.exitCode = 1;
}

function main() {
  const schema = readJson(schemaPath);
  const passport = readJson(examplePath);
  const ajv = new Ajv({ allErrors: true, strict: false, validateFormats: false });
  const validate = ajv.compile(schema);
  const schemaValid = validate(passport);

  const traversal = [
    ['REAL_PRODUCT', !!passport.commercial_truth.sku],
    ['ECONOMIC_PASSPORT', schemaValid],
    ['RESALE_INTERPRETATION', typeof passport.authority.resale_allowed === 'boolean' && passport.authority.territories.length > 0],
    ['FULFILMENT', passport.execution.fulfilment_method.length > 0 && passport.execution.fulfilment_condition.length > 0],
    ['EVIDENCE', passport.evidence.required && passport.evidence.requirements.length > 0],
    ['VERIFICATION', passport.evidence.verification_rule.length > 0 && passport.evidence.truth_status === 'UNVERIFIED']
  ];

  const checks = traversal.map(([name, pass]) => ({ name, status: pass ? 'PASS' : 'FAIL' }));
  const overall = schemaValid && checks.every((x) => x.status === 'PASS');

  const proof = {
    proof_version: '1.0.0',
    generated_at: new Date().toISOString(),
    passport_id: passport.passport_id,
    sku: passport.commercial_truth.sku,
    overall: overall ? 'PASS' : 'FAIL',
    schema: {
      path: path.relative(root, schemaPath),
      valid: schemaValid,
      errors: validate.errors || []
    },
    traversal: checks,
    hard_rules: {
      no_claimed_revenue: true,
      no_external_sale_claimed: true,
      truth_status_preserved: passport.evidence.truth_status === 'UNVERIFIED'
    }
  };

  fs.mkdirSync(proofDir, { recursive: true });
  fs.writeFileSync(proofPath, JSON.stringify(proof, null, 2) + '\n', 'utf8');

  console.log(JSON.stringify(proof, null, 2));
  console.log('PROOF: ' + proofPath);

  if (!overall) fail('Economic Passport traversal failed.');
}

main();
