#!/usr/bin/env node
/**
 * Sync-BECPrimeStorefront.js (CommonJS — BEC-PRIME is not "type":"module")
 * Copies BEC-PRIME/compiled/website → public/
 * Preserves MTG master so changes are visible on dreamledger.org after deploy.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const SOURCE = path.join(ROOT, 'BEC-PRIME', 'compiled', 'website');
const TARGET = path.join(ROOT, 'public');

const PRESERVE = [
  'avatar.html',
  'billboard.html',
  'silos/mtg/silo.json',
  'data/mtg-catalog.json',
  'data/_catalog-empty.template.json',
  'assets/mtg-deck-grid.js',
  'assets/mtg-deck-grid.css',
  'assets/silo-master.css',
  'data/decklists',
  'mtg',
  'mtg-list.html',
];

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    ensureDir(dest);
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    ensureDir(path.dirname(dest));
    fs.copyFileSync(src, dest);
  }
}

function snapshotPreserve() {
  const snaps = new Map();
  for (const rel of PRESERVE) {
    const full = path.join(TARGET, rel);
    if (!fs.existsSync(full)) continue;
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      const tmp = path.join(ROOT, '.tmp-preserve', rel);
      if (fs.existsSync(tmp)) fs.rmSync(tmp, { recursive: true, force: true });
      copyRecursive(full, tmp);
      snaps.set(rel, { type: 'dir', tmp });
    } else {
      snaps.set(rel, { type: 'file', content: fs.readFileSync(full) });
    }
  }
  return snaps;
}

function restorePreserve(snaps) {
  for (const [rel, snap] of snaps) {
    const full = path.join(TARGET, rel);
    if (snap.type === 'dir') {
      if (fs.existsSync(full)) fs.rmSync(full, { recursive: true, force: true });
      copyRecursive(snap.tmp, full);
      try { fs.rmSync(snap.tmp, { recursive: true, force: true }); } catch (_) {}
    } else {
      ensureDir(path.dirname(full));
      fs.writeFileSync(full, snap.content);
    }
  }
}

function main() {
  console.log('[Sync-BECPrimeStorefront] start (cjs)');
  console.log('  source:', SOURCE);
  console.log('  target:', TARGET);

  if (!fs.existsSync(SOURCE)) {
    console.error('[Sync-BECPrimeStorefront] SOURCE missing — nothing to sync');
    process.exit(1);
  }

  const snaps = snapshotPreserve();
  console.log('[Sync-BECPrimeStorefront] preserved', snaps.size, 'entries');

  copyRecursive(SOURCE, TARGET);
  console.log('[Sync-BECPrimeStorefront] copied compiled → public');

  restorePreserve(snaps);
  console.log('[Sync-BECPrimeStorefront] restored protected paths');

  const fallbacks = [
    'mtg/index.html',
    'silos/mtg/silo.json',
    'data/mtg-catalog.json',
    'assets/mtg-deck-grid.js',
    'assets/mtg-deck-grid.css',
  ];
  for (const rel of fallbacks) {
    const dest = path.join(TARGET, rel);
    const src = path.join(SOURCE, rel);
    if (!fs.existsSync(dest) && fs.existsSync(src)) {
      ensureDir(path.dirname(dest));
      fs.copyFileSync(src, dest);
      console.log('[Sync-BECPrimeStorefront] fallback from compiled:', rel);
    }
  }

  const tmpRoot = path.join(ROOT, '.tmp-preserve');
  if (fs.existsSync(tmpRoot)) {
    try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch (_) {}
  }

  const required = [
    'mtg/index.html',
    'silos/mtg/silo.json',
    'data/mtg-catalog.json',
    'assets/mtg-deck-grid.js',
  ];
  let ok = true;
  for (const rel of required) {
    const full = path.join(TARGET, rel);
    const exists = fs.existsSync(full);
    console.log('  ' + (exists ? 'OK' : 'MISSING') + '  public/' + rel);
    if (!exists) ok = false;
  }

  const mtgIndex = path.join(TARGET, 'mtg/index.html');
  if (fs.existsSync(mtgIndex)) {
    const body = fs.readFileSync(mtgIndex, 'utf8');
    if (!body.includes('/silos/mtg/silo.json') || !body.includes('Sell a single')) {
      const compiled = path.join(SOURCE, 'mtg/index.html');
      if (fs.existsSync(compiled)) {
        const cb = fs.readFileSync(compiled, 'utf8');
        if (cb.includes('/silos/mtg/silo.json') && cb.includes('Sell a single')) {
          fs.writeFileSync(mtgIndex, cb);
          console.log('[Sync-BECPrimeStorefront] forced compiled MTG master index');
        } else {
          console.error('[Sync-BECPrimeStorefront] MTG index is still legacy — FAIL');
          ok = false;
        }
      } else {
        console.error('[Sync-BECPrimeStorefront] MTG index is still legacy — FAIL');
        ok = false;
      }
    }
  }

  if (!ok) {
    console.error('[Sync-BECPrimeStorefront] MTG master incomplete — prestart FAIL');
    process.exit(1);
  }

  console.log('[Sync-BECPrimeStorefront] MTG master LIVE_GATE_OK');
  console.log('[Sync-BECPrimeStorefront] done');
}

main();
