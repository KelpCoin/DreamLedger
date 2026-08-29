'use strict';
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'distribution', 'assets', 'QR-CANONICAL-001.svg');
const URL = 'https://dreamledger.org/go';
async function compile() {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  await QRCode.toFile(OUT, URL, { type: 'svg', errorCorrectionLevel: 'M', margin: 3, width: 1000 });
  const proof = { schema_version: 'BEC-CANONICAL-QR-1.0', asset_id: 'QR-CANONICAL-001', destination: URL, output: path.relative(ROOT, OUT), status: 'PASS', generated_at: new Date().toISOString() };
  fs.writeFileSync(path.join(ROOT, 'distribution', 'assets', 'QR-CANONICAL-001.json'), JSON.stringify(proof, null, 2) + '\n', 'utf8');
  return proof;
}
if (require.main === module) compile().then(x => console.log(JSON.stringify(x, null, 2))).catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { compile };
