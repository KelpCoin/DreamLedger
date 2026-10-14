'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const QRCode = require('qrcode');

const ROOT = path.join(__dirname, '..');
const PUBLIC_ROOT = path.resolve(ROOT, '..', 'public');
const URL = 'https://dreamledger.org/go?src=qr-canonical';

const OUTPUTS = [
  path.join(ROOT, 'distribution', 'assets', 'QR-CANONICAL-001.svg'),
  path.join(PUBLIC_ROOT, 'assets', 'qr-canonical.svg'),
  path.join(PUBLIC_ROOT, 'qr', 'canonical.svg')
];
const PNG_OUTPUT = path.join(PUBLIC_ROOT, 'assets', 'qr-canonical.png');
const PROOF_OUTPUT = path.join(ROOT, 'distribution', 'assets', 'QR-CANONICAL-001.json');

async function compile() {
  const svgOptions = { type: 'svg', errorCorrectionLevel: 'M', margin: 4, width: 1200 };
  const pngOptions = { type: 'png', errorCorrectionLevel: 'M', margin: 4, width: 1600 };
  for (const out of OUTPUTS) {
    fs.mkdirSync(path.dirname(out), { recursive: true });
    await QRCode.toFile(out, URL, svgOptions);
  }
  fs.mkdirSync(path.dirname(PNG_OUTPUT), { recursive: true });
  await QRCode.toFile(PNG_OUTPUT, URL, pngOptions);

  const hashes = {};
  for (const out of [...OUTPUTS, PNG_OUTPUT]) {
    hashes[path.relative(path.resolve(ROOT, '..'), out)] =
      crypto.createHash('sha256').update(fs.readFileSync(out)).digest('hex');
  }
  const proof = {
    schema_version: 'BEC-CANONICAL-QR-1.1',
    asset_id: 'QR-CANONICAL-001',
    destination: URL,
    outputs: [...OUTPUTS, PNG_OUTPUT].map(out => path.relative(path.resolve(ROOT, '..'), out)),
    sha256: hashes,
    generated_at: new Date().toISOString(),
    status: 'PASS',
    note: 'The same first-party canonical QR is generated for package inserts and all buyer-facing fulfillment artifacts.'
  };
  fs.writeFileSync(PROOF_OUTPUT, JSON.stringify(proof, null, 2) + '\n', 'utf8');
  return proof;
}

if (require.main === module) {
  compile().then(x => console.log(JSON.stringify(x, null, 2))).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
module.exports = { compile };
