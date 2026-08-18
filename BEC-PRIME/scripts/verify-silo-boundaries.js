const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const CONTRACT_PATH = path.join(ROOT, 'docs', 'SILO-BOUNDARY-CONTRACT.json');
const PROOF_DIR = path.join(ROOT, 'PROOF');
const PROOF_PATH = path.join(PROOF_DIR, 'silo-boundary-proof.json');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function scanFile(file, forbiddenTerms) {
  const text = fs.readFileSync(file, 'utf8');
  const hits = [];
  for (const term of forbiddenTerms) {
    if (text.toLowerCase().includes(term.toLowerCase())) hits.push(term);
  }
  return hits;
}

const contract = readJson(CONTRACT_PATH);
const requiredRoots = [
  path.join(ROOT, 'BEC-PRIME', 'compiled', 'website'),
  path.join(ROOT, 'BEC-PRIME', 'catalog', 'offers'),
  path.join(ROOT, 'BEC-PRIME', 'catalog', 'products')
];
const scanRoots = [
  ...requiredRoots,
  ROOT
];

const missingRoots = requiredRoots
  .filter(root => !fs.existsSync(root))
  .map(root => path.relative(ROOT, root));

const files = [];
for (const root of scanRoots) {
  if (!fs.existsSync(root)) continue;
  if (root === ROOT) {
    files.push(...walk(root).filter(file => /\.(html|htm)$/i.test(file)));
  } else if (fs.statSync(root).isFile()) {
    files.push(root);
  } else {
    files.push(...walk(root));
  }
}

const uniqueFiles = [...new Set(files)];
const findings = [];
for (const file of uniqueFiles) {
  const hits = scanFile(file, contract.forbidden_terms || []);
  if (hits.length) findings.push({ file: path.relative(ROOT, file), hits });
}

const domainFindings = [];
for (const file of uniqueFiles) {
  const text = fs.readFileSync(file, 'utf8').toLowerCase();
  for (const domain of contract.forbidden_domains || []) {
    if (text.includes(domain.toLowerCase())) {
      domainFindings.push({ file: path.relative(ROOT, file), domain });
    }
  }
}

const status = missingRoots.length === 0 && findings.length === 0 && domainFindings.length === 0 ? 'PASS' : 'FAIL';
const proof = {
  schema: 'BROWNEYE/SILO-BOUNDARY-PROOF/v2',
  status,
  surface: contract.surface,
  silo: contract.silo,
  checked_at: new Date().toISOString(),
  contract: path.relative(ROOT, CONTRACT_PATH),
  required_roots: requiredRoots.map(root => path.relative(ROOT, root)),
  missing_roots: missingRoots,
  scanned_file_count: uniqueFiles.length,
  scanned_files: uniqueFiles.map(file => path.relative(ROOT, file)),
  forbidden_term_findings: findings,
  forbidden_domain_findings: domainFindings,
  rule: contract.rule,
  enforcement: contract.enforcement
};

fs.mkdirSync(PROOF_DIR, { recursive: true });
fs.writeFileSync(PROOF_PATH, JSON.stringify(proof, null, 2) + '\n', 'utf8');

if (status !== 'PASS') {
  console.error('FAIL: DreamLedger silo boundary violated or required public surface is missing.');
  console.error(JSON.stringify(proof, null, 2));
  process.exit(1);
}

console.log('PASS: DreamLedger silo boundary verified.');
console.log('Scanned files: ' + uniqueFiles.length);
console.log('Proof: ' + path.relative(ROOT, PROOF_PATH));
