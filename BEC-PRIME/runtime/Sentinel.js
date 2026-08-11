'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const PROOF_DIR = path.resolve(process.env.PROOF_DATA_DIR || path.join(ROOT, 'data', 'proofs'));

function sha256(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function check(name, pass, detail) {
  return { name, pass: Boolean(pass), detail: String(detail || '') };
}

function run(gauntlet) {
  const checks = [];
  const required = [
    'server.js',
    'dreamiez-account.js',
    'elohim/ElohimV6.js',
    'gauntlet/GauntletV6.js',
    'proxy/DigitalProxy.js',
    'runtime/ControlPlane.js',
    'runtime/DemandRadar.js'
  ];
  for (const rel of required) checks.push(check(`file:${rel}`, fs.existsSync(path.join(ROOT, rel)), 'required runtime file'));
  checks.push(check('gauntlet:pass', gauntlet && gauntlet.status === 'PASS', gauntlet ? gauntlet.status : 'missing'));
  checks.push(check('catalog:offers', fs.existsSync(path.join(ROOT, 'catalog', 'offers', 'offers.json')), 'canonical offer catalog exists'));
  checks.push(check('catalog:ip', fs.existsSync(path.join(ROOT, 'catalog', 'ip-capabilities.json')), 'canonical IP catalog exists'));
  checks.push(check('surface:index', fs.existsSync(path.join(ROOT, 'compiled', 'website', 'index.html')), 'compiled homepage exists'));
  checks.push(check('surface:marketplace', fs.existsSync(path.join(ROOT, 'compiled', 'website', 'assets', 'marketplace-live.js')), 'marketplace runtime exists'));
  checks.push(check('public:secret-scan', !/sk_(live|test)_[A-Za-z0-9]+|whsec_[A-Za-z0-9]+|-----BEGIN (?:RSA |OPENSSH )?PRIVATE KEY-----/.test(fs.readFileSync(path.join(ROOT, 'catalog', 'ip-capabilities.json'), 'utf8')), 'public IP catalog contains no obvious secret markers'));
  const verdict = checks.every(x => x.pass) ? 'PASS' : 'FAIL';
  const proof = {
    schema: 'BEC-PRIME/SENTINEL/v1',
    checked_at: new Date().toISOString(),
    verdict,
    checks,
    proof_hash: sha256(JSON.stringify(checks)),
    policy: 'Sentinel may stop unsafe startup, but it may not publish, charge, approve, or execute external actions.'
  };
  fs.mkdirSync(PROOF_DIR, { recursive: true });
  fs.writeFileSync(path.join(PROOF_DIR, 'SENTINEL-LATEST.json'), JSON.stringify(proof, null, 2) + '\n', 'utf8');
  return proof;
}

module.exports = { run };
