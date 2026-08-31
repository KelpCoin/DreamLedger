'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data', 'creator');
const BANK = path.join(DATA, 'word-bank.json');
const STENCILS = path.join(DATA, 'stencils.json');
const RECIPES = path.join(DATA, 'generation-recipes.json');
const SIGNALS = path.join(DATA, 'signals.jsonl');

function ensure() {
  fs.mkdirSync(DATA, { recursive: true });
  if (!fs.existsSync(BANK)) write(BANK, { schema_version: 'word-bank-v1', words: {} });
  if (!fs.existsSync(STENCILS)) write(STENCILS, { schema_version: 'stencil-v1', stencils: [] });
  if (!fs.existsSync(RECIPES)) write(RECIPES, { schema_version: 'generation-recipe-v1', recipes: [] });
  if (!fs.existsSync(SIGNALS)) fs.writeFileSync(SIGNALS, '', 'utf8');
}
function read(file) { ensure(); return JSON.parse(fs.readFileSync(file, 'utf8')); }
function write(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', 'utf8'); }
function sha(value) { return crypto.createHash('sha256').update(String(value)).digest('hex'); }
function now() { return new Date().toISOString(); }
function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, Number(n) || 0)); }

function decay(word, at) {
  const bank = read(BANK);
  const item = bank.words[word];
  if (!item) return null;
  const days = Math.max(0, (new Date(at || now()) - new Date(item.last_updated_at || now())) / 86400000);
  const halfLife = Math.max(1, Number(item.half_life_days || 30));
  item.current_weight = clamp(Number(item.current_weight || item.base_weight || 1) * Math.pow(0.5, days / halfLife), 0.001, 1000);
  item.last_updated_at = at || now();
  write(BANK, bank);
  return item;
}

function upsertWord(word, patch) {
  ensure();
  const bank = read(BANK);
  const key = String(word || '').trim().toLowerCase();
  if (!key || key.length > 100) throw new Error('INVALID_WORD');
  const existing = bank.words[key] || { base_weight: 1, current_weight: 1, half_life_days: 30, upvotes: 0, downvotes: 0, last_updated_at: now() };
  bank.words[key] = {
    ...existing,
    ...patch,
    base_weight: clamp(patch.base_weight === undefined ? existing.base_weight : patch.base_weight, 0.001, 1000),
    current_weight: clamp(patch.current_weight === undefined ? existing.current_weight : patch.current_weight, 0.001, 1000),
    half_life_days: clamp(patch.half_life_days === undefined ? existing.half_life_days : patch.half_life_days, 1, 3650),
    last_updated_at: now()
  };
  write(BANK, bank);
  return bank.words[key];
}

function vote(word, direction, reputation) {
  const item = decay(String(word || '').trim().toLowerCase());
  if (!item) throw new Error('WORD_NOT_FOUND');
  const dir = Number(direction) >= 0 ? 1 : -1;
  const weight = clamp(reputation || 1, 0.1, 100);
  return upsertWord(word, {
    base_weight: clamp(item.base_weight + dir * weight * 0.1, 0.001, 1000),
    upvotes: item.upvotes + (dir > 0 ? 1 : 0),
    downvotes: item.downvotes + (dir < 0 ? 1 : 0)
  });
}

function weightedWords(bankName, count) {
  const bank = read(BANK);
  const entries = Object.entries(bank.words).filter(([_, v]) => !bankName || v.bank === bankName);
  const out = [];
  let seed = parseInt(sha(bankName + now()).slice(0, 8), 16) >>> 0;
  function rnd() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
  for (let i = 0; i < Math.max(1, Math.min(100, count || 1)); i++) {
    const total = entries.reduce((n, [, v]) => n + Math.max(0.001, Number(v.current_weight || v.base_weight || 1)), 0);
    let pick = rnd() * total;
    for (const [word, v] of entries) {
      pick -= Math.max(0.001, Number(v.current_weight || v.base_weight || 1));
      if (pick <= 0) { out.push(word); break; }
    }
  }
  return out;
}

function recordSignal(signal) {
  ensure();
  const item = { schema_version: 'signal-weight-v1', id: 'sig_' + sha(JSON.stringify(signal) + now()).slice(0, 16), observed_at: now(), ...signal };
  fs.appendFileSync(SIGNALS, JSON.stringify(item) + '\n', 'utf8');
  return item;
}

function applySignal(signal) {
  const keyword = String(signal.keyword || '').trim().toLowerCase();
  if (!keyword) throw new Error('SIGNAL_KEYWORD_REQUIRED');
  const velocity = clamp(signal.velocity || 0, -1, 10);
  const boost = 1 + velocity * 0.1;
  const item = upsertWord(keyword, { current_weight: clamp((read(BANK).words[keyword]?.current_weight || 1) * boost, 0.001, 1000), last_signal_at: now() });
  return recordSignal({ ...signal, applied_boost: boost, resulting_weight: item.current_weight });
}

function createStencil(stencil) {
  ensure();
  const data = read(STENCILS);
  const id = String(stencil.id || 'stencil_' + sha(JSON.stringify(stencil)).slice(0, 12));
  const value = { schema_version: 'stencil-v1', id, version: 1, status: 'active', created_at: now(), ...stencil };
  data.stencils = data.stencils.filter(x => x.id !== id);
  data.stencils.push(value);
  write(STENCILS, data);
  return value;
}

function createRecipe(recipe) {
  ensure();
  const data = read(RECIPES);
  const id = String(recipe.id || 'recipe_' + sha(JSON.stringify(recipe)).slice(0, 12));
  const value = { schema_version: 'generation-recipe-v1', id, version: 1, status: 'active', created_at: now(), ...recipe };
  data.recipes = data.recipes.filter(x => x.id !== id);
  data.recipes.push(value);
  write(RECIPES, data);
  return value;
}

function renderStencil(id) {
  const data = read(STENCILS);
  const stencil = data.stencils.find(x => x.id === id && x.status === 'active');
  if (!stencil) throw new Error('STENCIL_NOT_FOUND');
  let output = String(stencil.template || '');
  const slots = stencil.slots || {};
  for (const [slot, spec] of Object.entries(slots)) {
    const choices = weightedWords(spec.word_bank, Number(spec.count || 1));
    output = output.replaceAll('{' + slot + '}', choices[0] || '');
  }
  return { stencil_id: id, rendered_prompt: output, generated_at: now(), provenance_sha256: sha(JSON.stringify({ stencil, output })) };
}

function snapshot() {
  ensure();
  return {
    word_bank: read(BANK),
    stencils: read(STENCILS),
    generation_recipes: read(RECIPES),
    signals_path: path.relative(ROOT, SIGNALS).replace(/\\/g, '/')
  };
}

module.exports = { upsertWord, vote, weightedWords, recordSignal, applySignal, createStencil, createRecipe, renderStencil, snapshot };
