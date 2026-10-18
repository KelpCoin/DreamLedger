'use strict';
/** Cloud/local: emit website faces + silo registry into public/ */
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const steps = [
  path.join(ROOT, 'compiler', 'WebsiteFaceCompiler.js'),
  path.join(ROOT, 'compiler', 'SiloFaceCompiler.js')
];

for (const file of steps) {
  const r = spawnSync(process.execPath, [file], { cwd: ROOT, stdio: 'inherit' });
  if (r.status !== 0) {
    console.error('[compile-public-faces] failed:', file, 'status', r.status);
    process.exit(r.status || 1);
  }
}
console.log(JSON.stringify({ status: 'PASS', steps: steps.map((s) => path.relative(ROOT, s)) }, null, 2));
