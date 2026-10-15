'use strict';

const fs = require('fs');
const path = require('path');

const SOURCE = path.join(__dirname, '..', 'BEC-PRIME', 'compiled', 'website');
const DEST = __dirname;
const ALLOWED = new Set(['.html', '.css', '.js', '.svg', '.png', '.jpg', '.jpeg', '.webp', '.ico', '.txt', '.xml', '.json']);

function copyTree(src, dst) {
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '.well-known') continue;
      fs.mkdirSync(to, { recursive: true });
      copyTree(from, to);
    } else if (
      ALLOWED.has(path.extname(entry.name).toLowerCase()) &&
      !['catalog.json', 'server.js', 'package.json', 'package-lock.json'].includes(entry.name)
    ) {
      fs.copyFileSync(from, to);
    }
  }
}

function ensureDir(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
}

if (!fs.existsSync(SOURCE)) {
  throw new Error('BEC-PRIME compiled website missing. Run npm run compile first.');
}

const canonicalPublicFiles = [
  'avatar.html',
  'billboard.html',
  'mtg/index.html',
  'mtg/quintorius-field-historian.html',
  'mtg-list.html',
  'silos/mtg/silo.json',
  'data/mtg-catalog.json',
  'data/decklists/quintorius.json',
  'data/_catalog-empty.template.json',
  'assets/mtg-deck-grid.js',
  'assets/mtg-deck-grid.css',
  'assets/silo-master.css',
];

const canonicalSnapshots = new Map(
  canonicalPublicFiles.map((rel) => {
    const file = path.join(DEST, rel);
    return [rel, fs.existsSync(file) ? fs.readFileSync(file) : null];
  })
);

copyTree(SOURCE, DEST);

for (const [rel, bytes] of canonicalSnapshots) {
  if (bytes) {
    const target = path.join(DEST, rel);
    ensureDir(target);
    fs.writeFileSync(target, bytes);
  }
}

const compiledMtgFallbacks = [
  'mtg/index.html',
  'silos/mtg/silo.json',
  'data/mtg-catalog.json',
  'assets/mtg-deck-grid.js',
  'assets/mtg-deck-grid.css',
  'data/decklists/quintorius.json',
  'mtg/quintorius-field-historian.html',
];
for (const rel of compiledMtgFallbacks) {
  const dest = path.join(DEST, rel);
  const src = path.join(SOURCE, rel);
  if (!fs.existsSync(dest) && fs.existsSync(src)) {
    ensureDir(dest);
    fs.copyFileSync(src, dest);
  }
}

const mtgIndex = path.join(DEST, 'mtg/index.html');
const mtgBody = fs.existsSync(mtgIndex) ? fs.readFileSync(mtgIndex, 'utf8') : '';
if (!mtgBody.includes('/silos/mtg/silo.json') || !mtgBody.includes('Sell a single')) {
  const fromCompiled = path.join(SOURCE, 'mtg/index.html');
  if (fs.existsSync(fromCompiled)) {
    const compiledBody = fs.readFileSync(fromCompiled, 'utf8');
    if (compiledBody.includes('/silos/mtg/silo.json')) {
      ensureDir(mtgIndex);
      fs.writeFileSync(mtgIndex, compiledBody);
    }
  }
}

function copyStage0File(rel) {
  const from = path.join(__dirname, '..', rel);
  const to = path.join(DEST, rel);
  if (!fs.existsSync(from)) throw new Error('Required PhinHaven source missing: ' + rel);
  ensureDir(to);
  fs.copyFileSync(from, to);
}

for (const rel of ['phinhaven.html', 'phinhaven/hotel/index.html', 'phinhaven/shallows/index.html']) {
  copyStage0File(rel);
}

const required = [
  'index.html',
  'mtg/index.html',
  'mtg-list.html',
  'silos/mtg/silo.json',
  'data/mtg-catalog.json',
  'assets/mtg-deck-grid.js',
];
const missing = required.filter((rel) => !fs.existsSync(path.join(DEST, rel)));
if (missing.length) {
  throw new Error('Required public surface missing: ' + missing.join(', '));
}

const finalMtg = fs.readFileSync(path.join(DEST, 'mtg/index.html'), 'utf8');
if (!finalMtg.includes('/silos/mtg/silo.json')) {
  throw new Error('MTG master index is not manifest-driven after sync — refusing to start');
}

console.log(
  JSON.stringify({
    status: 'PASS',
    mtg_master: 'LIVE_GATE_OK',
    required,
    preserved: canonicalPublicFiles.filter((rel) => canonicalSnapshots.get(rel)),
  })
);
