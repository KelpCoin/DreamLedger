const fs = require('fs');
const path = require('path');

function mustFile(p) {
  if (!fs.existsSync(p)) throw new Error(`PREFLIGHT_MISSING_FILE:${p}`);
}

function mustPackage(pkg, name) {
  if (!pkg.dependencies || !pkg.dependencies[name]) {
    throw new Error(`PREFLIGHT_MISSING_DEPENDENCY:${name}`);
  }
}

const root = path.resolve(__dirname, '..');
const pkgPath = path.join(root, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

mustFile(path.join(root, 'compiler', 'OfferCompiler.js'));
mustFile(path.join(root, 'start.js'));
mustPackage(pkg, 'ajv');
mustPackage(pkg, 'qrcode');

require('ajv');
require('qrcode');

console.log(`RENDER_PREFLIGHT_OK version=${pkg.version}`);
console.log('AJV_RUNTIME_OK');
console.log('QRCODE_RUNTIME_OK');
console.log('OFFER_COMPILER_PRESENT');
console.log('START_ENTRYPOINT_PRESENT');
