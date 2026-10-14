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

if (!fs.existsSync(SOURCE)) {
  throw new Error('BEC-PRIME compiled website missing. Run npm run compile first.');
}

// Preserve reviewed public surfaces that compiled legacy must not overwrite.
const canonicalPublicFiles = [
  'avatar.html',
  'billboard.html',
  // MTG master (cube-clone candidate)
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
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, bytes);
  }
}

function copyStage0File(rel) {
  const from = path.join(__dirname, '..', rel);
  const to = path.join(DEST, rel);
  if (!fs.existsSync(from)) throw new Error('Required PhinHaven source missing: ' + rel);
  fs.mkdirSync(path.dirname(to), { recursive: true });
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

console.log(
  JSON.stringify({
    status: 'PASS',
    source: SOURCE,
    destination: DEST,
    required,
    preserved: canonicalPublicFiles.filter((rel) => canonicalSnapshots.get(rel)),
    mtg_master: 'PRESERVED',
  })
);
