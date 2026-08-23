const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const DOCS = path.join(ROOT, 'docs');
const STATIC_OUT = path.join(ROOT, 'dist-pages');

function run(script, args = []) {
  cp.execFileSync(process.execPath, [path.join(__dirname, script), ...args], {
    cwd: ROOT,
    stdio: 'inherit'
  });
}

function reset(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

function copy(rel) {
  const src = path.join(DOCS, rel);
  const dst = path.join(STATIC_OUT, rel);
  if (!fs.existsSync(src)) throw new Error(`Missing Pages source: docs/${rel}`);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
}

function copyDir(rel) {
  const src = path.join(DOCS, rel);
  const dst = path.join(STATIC_OUT, rel);
  if (!fs.existsSync(src)) return;
  fs.cpSync(src, dst, { recursive: true, force: true });
}

const sha = cp.execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
const targets = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'release-targets.json'), 'utf8')).targets;

if (!targets.dreamledger || targets.dreamledger.silo !== 'MTG') {
  throw new Error('DreamLedger target must remain MTG silo');
}
if (targets.amplissa && targets.amplissa.source_root !== null) {
  throw new Error('Amplissa source is not isolated: refusing compilation');
}

console.log(`BEC compiler source=${sha}`);
console.log('Stage 1: deterministic offer/surface compilation');
run('compile-offers.js');
run('compile-surface.js');

console.log('Stage 2: DreamLedger Node release artifact');
run('compile-release.js', ['dreamledger']);

console.log('Stage 3: isolated GitHub Pages surface');
reset(STATIC_OUT);
for (const name of fs.readdirSync(DOCS)) {
  if (name.endsWith('.html') || name === 'CNAME' || name === 'robots.txt') copy(name);
}
for (const rel of ['assets', 'public']) copyDir(rel);

const manifest = {
  schema_version: 'BEC-COMPILER-1.0',
  status: 'PASS',
  source_sha: sha,
  built_at_utc: new Date().toISOString(),
  targets: {
    dreamledger: {
      silo: 'MTG',
      static_artifact: 'dist-pages',
      node_artifact: 'dist-release/dreamledger',
      domain: targets.dreamledger.domain
    },
    amplissa: {
      silo: 'AMPLISSA',
      status: 'SOURCE_REQUIRED',
      compiled: false
    }
  },
  exclusions: [
    'server.js from GitHub Pages static artifact',
    'Proof source data from GitHub Pages static artifact',
    'Amplissa content from DreamLedger artifact'
  ]
};

fs.writeFileSync(path.join(STATIC_OUT, 'compiler-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify(manifest, null, 2));
