'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cp = require('child_process');

const root = path.resolve(__dirname, '..', '..');
const outDir = path.join(root, 'BEC-PRIME', 'data', 'cortex-builder');
fs.mkdirSync(outDir, { recursive: true });

const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const run = command => cp.execSync(command, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const files = () => run('git ls-files -z').split('\0').filter(Boolean);

const payloadPath = path.join(outDir, 'claimed-job.json');
const claimed = fs.existsSync(payloadPath) ? JSON.parse(fs.readFileSync(payloadPath, 'utf8')) : null;
const payload = (claimed && claimed.payload) || {};

if (payload.job_mode !== 'phinhaven_rename_304') throw new Error('UNSUPPORTED_BUILDER_MODE');
if (payload.write_scope_mode !== 'phinhaven_user_facing_rename_only') throw new Error('WRITE_SCOPE_MODE_MISSING');

function protectedPath(file) {
  const p = file.replaceAll('\\', '/').toLowerCase();
  if (p.startsWith('supabase/migrations/')) return true;
  if (p.startsWith('proof/')) return true;
  if (p.startsWith('bec-prime/run-proofs/')) return true;
  if (p.startsWith('.github/workflows/')) return true;
  return ['billboard','maximona','automation-rescue','mtg','happyhomarid','collectorscoast','amplissa'].some(x => p.includes(x));
}

function readText(file) {
  const data = fs.readFileSync(path.join(root, file));
  if (data.includes(0)) return null;
  const text = data.toString('utf8');
  return text.includes('\uFFFD') ? null : text;
}

function technicalSnapshot(list) {
  const result = new Set();
  const re = /\bkelplantis_[A-Za-z0-9_]+\b/g;
  for (const file of list) {
    const text = readText(file);
    if (text === null) continue;
    for (const match of text.matchAll(re)) result.add(match[0]);
  }
  return [...result].sort();
}

function rename(list) {
  const replacements = [
    [/FINHAVEN/g, 'PHINHAVEN'],
    [/Finhaven/g, 'PhinHaven'],
    [/finhaven/g, 'phinhaven'],
    [/KELPLANTIS/g, 'PHINHAVEN'],
    [/Kelplantis/g, 'PhinHaven'],
    [/kelplantis/g, 'phinhaven']
  ];
  const changed = [];
  const technical = /\bkelplantis_[A-Za-z0-9_]+\b/gi;
  let tokenNo = 0;

  for (const file of list) {
    if (protectedPath(file)) continue;
    const original = readText(file);
    if (original === null) continue;
    if (!/Finhaven|FINHAVEN|finhaven|Kelplantis|KELPLANTIS|kelplantis/.test(original)) continue;

    const tokens = new Map();
    let text = original.replace(technical, token => {
      const key = `__CORTEX_TECH_${tokenNo++}__`;
      tokens.set(key, token);
      return key;
    });
    for (const [re, value] of replacements) text = text.replace(re, value);
    for (const [key, value] of tokens) text = text.replaceAll(key, value);

    if (text !== original) {
      fs.writeFileSync(path.join(root, file), text, 'utf8');
      changed.push(file);
    }
  }
  return changed.sort();
}

function remainingLegacy(list) {
  const re = /Finhaven|FINHAVEN|finhaven|Kelplantis|KELPLANTIS|kelplantis/gi;
  const result = [];
  for (const file of list) {
    const text = readText(file);
    if (text === null) continue;
    const matches = [...text.matchAll(re)];
    if (matches.length) result.push({ path: file, count: matches.length, protected: protectedPath(file) });
  }
  return result;
}

const list = files();
const technicalBefore = technicalSnapshot(list);
const changedPaths = rename(list);
const afterList = files();
const technicalAfter = technicalSnapshot(afterList);
const remaining = remainingLegacy(afterList);
const forbiddenChanged = changedPaths.filter(protectedPath);
const unprotectedLegacy = remaining.filter(x => !x.protected);
const technicalPreserved = JSON.stringify(technicalBefore) === JSON.stringify(technicalAfter);

const proof = {
  schema: 'BROWNEYE-CORTEX/RENAME-BUILDER/v2',
  issue: 304,
  target_brand: 'PhinHaven',
  rejected_brand: 'Finhaven',
  source_brand: 'Kelplantis',
  scope_mode: payload.write_scope_mode,
  base_sha: run('git rev-parse HEAD').trim(),
  changed_paths: changedPaths,
  changed_path_count: changedPaths.length,
  forbidden_path_changes: forbiddenChanged,
  technical_identifiers_before: technicalBefore,
  technical_identifiers_after: technicalAfter,
  technical_identifiers_preserved: technicalPreserved,
  remaining_legacy_references: remaining,
  unprotected_legacy_references: unprotectedLegacy,
  deterministic_builder: true,
  status: technicalPreserved && forbiddenChanged.length === 0 && unprotectedLegacy.length === 0 ? 'PASS' : 'FAIL',
  generated_at: new Date().toISOString()
};

proof.content_sha256 = sha256(JSON.stringify(proof));
fs.writeFileSync(path.join(outDir, 'rename-builder-proof.json'), JSON.stringify(proof, null, 2) + '\n');
console.log(JSON.stringify(proof, null, 2));
if (proof.status !== 'PASS') process.exit(2);
