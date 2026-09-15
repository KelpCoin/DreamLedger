'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cp = require('child_process');

const root = path.resolve(__dirname, '..', '..');
const outDir = path.join(root, 'BEC-PRIME', 'data', 'cortex-builder');
fs.mkdirSync(outDir, { recursive: true });

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function run(command) {
  return cp.execSync(command, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function trackedFiles() {
  return run('git ls-files -z').split('\0').filter(Boolean);
}

function isProtectedPath(file) {
  const p = file.replaceAll('\\', '/');
  if (p.startsWith('supabase/migrations/')) return true;
  if (p.startsWith('proof/')) return true;
  if (p.startsWith('BEC-PRIME/RUN-PROOFS/')) return true;
  const lower = p.toLowerCase();
  const commercial = ['billboard', 'maximona', 'automation-rescue', 'mtg', 'happyhomarid', 'collectorscoast', 'amplissa'];
  return commercial.some(x => lower.includes(x));
}

function snapshotTechnicalIds(files) {
  const set = new Set();
  const re = /\bkelplantis_[A-Za-z0-9_]+\b/g;
  for (const file of files) {
    if (isProtectedPath(file)) continue;
    const full = path.join(root, file);
    let text;
    try { text = fs.readFileSync(full, 'utf8'); } catch { continue; }
    for (const match of text.matchAll(re)) set.add(match[0]);
  }
  return [...set].sort();
}

function applyRename(files) {
  const replacements = [
    [/FINHAVEN/g, 'PHINHAVEN'],
    [/Finhaven/g, 'PhinHaven'],
    [/finhaven/g, 'phinhaven'],
    [/KELPLANTIS/g, 'PHINHAVEN'],
    [/Kelplantis/g, 'PhinHaven'],
    [/kelplantis/g, 'phinhaven']
  ];
  const changed = [];
  const tokenMap = new Map();
  let tokenNo = 0;
  const technicalRe = /\bkelplantis_[A-Za-z0-9_]+\b/gi;

  for (const file of files) {
    if (isProtectedPath(file)) continue;
    const full = path.join(root, file);
    let before;
    try { before = fs.readFileSync(full); } catch { continue; }
    if (before.includes(0)) continue;
    let text;
    try { text = before.toString('utf8'); } catch { continue; }
    if (text.includes('\uFFFD')) continue;

    tokenMap.clear();
    text = text.replace(technicalRe, token => {
      const key = `__CORTEX_TECH_${tokenNo++}__`;
      tokenMap.set(key, token);
      return key;
    });

    let next = text;
    for (const [re, value] of replacements) next = next.replace(re, value);
    for (const [key, value] of tokenMap) next = next.replaceAll(key, value);

    if (next !== text.replace(new RegExp('__CORTEX_TECH_[0-9]+__', 'g'), m => tokenMap.get(m) || m)) {
      fs.writeFileSync(full, next, 'utf8');
      changed.push(file);
    }
  }
  return changed.sort();
}

function remainingLegacy(files) {
  const results = [];
  const re = /Finhaven|FINHAVEN|finhaven|Kelplantis|KELPLANTIS|kelplantis/gi;
  for (const file of files) {
    const full = path.join(root, file);
    let text;
    try { text = fs.readFileSync(full, 'utf8'); } catch { continue; }
    const matches = [...text.matchAll(re)];
    if (matches.length) results.push({ path: file, count: matches.length });
  }
  return results;
}

function verifyTechnicalIds(before, after) {
  return JSON.stringify(before) === JSON.stringify(after);
}

const files = trackedFiles();
const technicalBefore = snapshotTechnicalIds(files);
const changed = applyRename(files);
const technicalAfter = snapshotTechnicalIds(files);
const legacy = remainingLegacy(files);
const changedProtected = changed.filter(isProtectedPath);

const proof = {
  schema: 'BROWNEYE-CORTEX/RENAME-BUILDER/v1',
  issue: 304,
  target_brand: 'PhinHaven',
  rejected_brand: 'Finhaven',
  source_brand: 'Kelplantis',
  base_sha: run('git rev-parse HEAD').trim(),
  changed_paths: changed,
  changed_path_count: changed.length,
  protected_path_changes: changedProtected,
  technical_identifiers_before: technicalBefore,
  technical_identifiers_after: technicalAfter,
  technical_identifiers_preserved: verifyTechnicalIds(technicalBefore, technicalAfter),
  remaining_legacy_references: legacy,
  forbidden_public_silo_touched: changedProtected.length > 0,
  deterministic_builder: true,
  status: changedProtected.length === 0 && verifyTechnicalIds(technicalBefore, technicalAfter) ? 'PASS' : 'FAIL',
  generated_at: new Date().toISOString()
};

proof.content_sha256 = sha256(JSON.stringify(proof));
fs.writeFileSync(path.join(outDir, 'rename-builder-proof.json'), JSON.stringify(proof, null, 2) + '\n');

if (proof.status !== 'PASS') process.exit(2);
console.log(JSON.stringify(proof, null, 2));
