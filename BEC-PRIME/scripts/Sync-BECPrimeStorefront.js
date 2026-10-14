#!/usr/bin/env node
/**
 * Sync-BECPrimeStorefront.js
 *
 * Contract-aligned storefront sync.
 * Copies BEC-PRIME/compiled/website → public/
 * Explicitly preserves paths that must survive the copy (MTG master + existing protects).
 *
 * Rule: shell + bindings clone. Inventory does not.
 * Gauntlet gate: live 200s for silo.json / catalog / grid / decklists required before activation clone.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const SOURCE = path.join(ROOT, 'BEC-PRIME', 'compiled', 'website');
const TARGET = path.join(ROOT, 'public');

/**
 * Paths relative to public/ that must never be wiped by the sync.
 * Add new silo masters here using the same pattern.
 */
const PRESERVE = [
  // Existing protects
  'avatar.html',
  'billboard.html',

  // MTG clone-ready master (must survive deploy)
  'silos/mtg/silo.json',
  'data/mtg-catalog.json',
  'data/_catalog-empty.template.json',
  'assets/mtg-deck-grid.js',
  'data/decklists',
  'mtg',
  'mtg/index.html',
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
      // Snapshot entire directory tree as a temp copy
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
      fs.rmSync(snap.tmp, { recursive: true, force: true });
    } else {
      ensureDir(path.dirname(full));
      fs.writeFileSync(full, snap.content);
    }
  }
}

function main() {
  console.log('[Sync-BECPrimeStorefront] start');
  console.log('  source:', SOURCE);
  console.log('  target:', TARGET);

  if (!fs.existsSync(SOURCE)) {
    console.error('[Sync-BECPrimeStorefront] SOURCE missing — nothing to sync');
    process.exitCode = 1;
    return;
  }

  // 1. Snapshot protected paths
  const snaps = snapshotPreserve();
  console.log('[Sync-BECPrimeStorefront] preserved', snaps.size, 'entries');

  // 2. Sync compiled → public (overwrite)
  //    We do a selective merge: copy everything from SOURCE, then restore preserves.
  copyRecursive(SOURCE, TARGET);
  console.log('[Sync-BECPrimeStorefront] copied compiled → public');

  // 3. Restore protected paths
  restorePreserve(snaps);
  console.log('[Sync-BECPrimeStorefront] restored protected paths');

  // 4. Clean temp
  const tmpRoot = path.join(ROOT, '.tmp-preserve');
  if (fs.existsSync(tmpRoot)) {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }

  // 5. Report MTG master status (truth only)
  const required = [
    'silos/mtg/silo.json',
    'data/mtg-catalog.json',
    'assets/mtg-deck-grid.js',
  ];
  let ok = true;
  for (const rel of required) {
    const full = path.join(TARGET, rel);
    const exists = fs.existsSync(full);
    console.log(`  ${exists ? 'OK' : 'MISSING'}  public/${rel}`);
    if (!exists) ok = false;
  }

  if (!ok) {
    console.warn('[Sync-BECPrimeStorefront] MTG master incomplete after sync — gauntlet will REJECT activation');
  } else {
    console.log('[Sync-BECPrimeStorefront] MTG master paths present');
  }

  console.log('[Sync-BECPrimeStorefront] done');
}

main();
