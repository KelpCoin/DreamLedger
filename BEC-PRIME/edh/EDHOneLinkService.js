'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const JOB_ROOT = path.join(ROOT, 'data', 'mtg', 'edh-jobs');
const PRODUCT_ROOT = path.join(ROOT, 'catalog', 'products');
const PIPELINE_VERSION = 'edh-one-link-v1';
const SUPPORTED_HOSTS = new Set([
  'manabox.app', 'www.manabox.app',
  'moxfield.com', 'www.moxfield.com',
  'archidekt.com', 'www.archidekt.com',
  'deckstats.net', 'www.deckstats.net',
  'aetherhub.com', 'www.aetherhub.com'
]);

function iso() { return new Date().toISOString(); }
function hash(value) { return crypto.createHash('sha256').update(String(value)).digest('hex'); }
function json(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function safeId(value) { return String(value || '').replace(/[^A-Za-z0-9_:-]/g, '').slice(0, 120); }
function sourceUrl(raw) {
  let u;
  try { u = new URL(String(raw || '')); } catch { throw Object.assign(new Error('SOURCE_URL_INVALID'), { statusCode: 422 }); }
  if (u.protocol !== 'https:') throw Object.assign(new Error('SOURCE_URL_MUST_BE_HTTPS'), { statusCode: 422 });
  if (!SUPPORTED_HOSTS.has(u.hostname.toLowerCase())) throw Object.assign(new Error('UNSUPPORTED_DECK_HOST'), { statusCode: 422 });
  return u;
}

async function fetchSource(url) {
  const response = await fetch(url.href, {
    redirect: 'follow',
    headers: {
      'user-agent': 'DreamLedger-EDH-OneLink/1.0',
      accept: 'text/html,text/plain,application/json'
    }
  });
  const text = await response.text();
  if (!response.ok) throw Object.assign(new Error('SOURCE_HTTP_' + response.status), { statusCode: 502 });
  if (text.length > 5000000) throw Object.assign(new Error('SOURCE_TOO_LARGE'), { statusCode: 413 });
  return text;
}

function decodeHtml(value) {
  return String(value)
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

function parseDeck(text) {
  const source = String(text || '');
  const cards = new Map();
  const add = (quantity, name) => {
    const clean = decodeHtml(String(name || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
    const q = Number(quantity || 1);
    if (!clean || !Number.isInteger(q) || q < 1 || q > 100 || clean.length > 120) return;
    if (/^(card|cardname|name|image|mana|commander|quantity|qty)$/i.test(clean)) return;
    if (!/^[A-Za-z0-9][A-Za-z0-9 ,.'’&()\-/:+!?’]*$/.test(clean)) return;
    cards.set(clean, (cards.get(clean) || 0) + q);
  };

  for (const match of source.matchAll(/(?:quantity|count|qty)["']?\s*[:=]\s*["']?(\d+)["']?[^}]{0,180}?(?:name|cardName)["']?\s*[:=]\s*["']([^"']{2,100})/gi)) add(match[1], match[2]);
  for (const match of source.matchAll(/(?:name|cardName)["']?\s*[:=]\s*["']([^"']{2,100})["'][^}]{0,180}?(?:quantity|count|qty)["']?\s*[:=]\s*["']?(\d+)/gi)) add(match[2], match[1]);
  for (const match of source.matchAll(/<img[^>]+alt=["']([^"']{2,100})["'][^>]*>/gi)) add(1, match[1]);
  for (const line of source.replace(/<[^>]+>/g, '\n').split(/\n+/)) {
    const match = line.trim().match(/^(\d{1,2})x?\s+(.{2,100})$/);
    if (match) add(match[1], match[2]);
  }

  const list = [...cards.entries()].map(([name, quantity]) => ({ name, quantity }))
    .filter(card => card.quantity > 0)
    .sort((a, b) => a.name.localeCompare(b.name));
  const total = list.reduce((sum, card) => sum + card.quantity, 0);
  if (total < 90 || total > 120) throw Object.assign(new Error('INVALID_DECK_CARD_COUNT_' + total), { statusCode: 422 });
  return list;
}

async function enrich(cards) {
  const enriched = [];
  for (const card of cards.slice(0, 120)) {
    try {
      const response = await fetch('https://api.scryfall.com/cards/named?exact=' + encodeURIComponent(card.name), {
        headers: { 'user-agent': 'DreamLedger-EDH-OneLink/1.0', accept: 'application/json' }
      });
      if (response.ok) {
        const data = await response.json();
        enriched.push({
          name: card.name,
          quantity: card.quantity,
          scryfall_id: data.id,
          oracle_id: data.oracle_id,
          mana_cost: data.mana_cost || '',
          type_line: data.type_line || '',
          oracle_text: data.oracle_text || '',
          color_identity: data.color_identity || [],
          image_uri: data.image_uris?.normal || data.card_faces?.[0]?.image_uris?.normal || null
        });
        continue;
      }
    } catch (_) {}
    enriched.push({ name: card.name, quantity: card.quantity, scryfall_id: null, oracle_id: null, mana_cost: '', type_line: '', oracle_text: '', color_identity: [], image_uri: null });
  }
  return enriched;
}

function featureSet(cards) {
  const all = cards.flatMap(card => Array(card.quantity).fill(card));
  const text = all.map(card => (card.name + ' ' + card.oracle_text + ' ' + card.type_line).toLowerCase());
  const count = pattern => text.filter(value => pattern.test(value)).length;
  return {
    cards: all.length,
    mana_sources: count(/\b(land|mana|add \{)/),
    ramp: count(/sol ring|arcane signet|signet|talisman|cultivate|kodama|ramp|mana vault|mana crypt|treasure/),
    draw: count(/draw a card|draw two|draws?|rhystic study|phyrexian arena|beast whisperer|guardian project/),
    interaction: count(/counter target|destroy target|exile target|return target|fight target|damage to target/),
    tutors: count(/search your library|tutor/),
    commanders: count(/legendary creature/)
  };
}

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6D2B79F5) | 0;
    let t = Math.imul(value ^ (value >>> 15), 1 | value);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function monteCarlo(deckA, deckB, seed, trials) {
  const a = featureSet(deckA);
  const b = featureSet(deckB);
  const random = seededRandom(seed);
  let wins = 0;
  const score = features => 1 + features.ramp * 0.7 + features.draw * 0.55 + features.interaction * 0.35 + features.tutors * 0.5 + (features.mana_sources / Math.max(1, features.cards)) * 30;
  const baseA = score(a);
  const baseB = score(b);
  for (let i = 0; i < trials; i += 1) {
    if (baseA * (0.75 + random() * 0.5) >= baseB * (0.75 + random() * 0.5)) wins += 1;
  }
  return {
    type: 'FIXTURE_BENCHMARK',
    engine: 'EDH-HEURISTIC-MONTE-CARLO',
    version: '1.1.0',
    seed,
    trials,
    turn_horizon: 8,
    estimated_win_rate: Number((wins / trials).toFixed(4)),
    score_summary: { deck_a: a, deck_b: b },
    caveat: 'Heuristic Monte Carlo benchmark for comparative consistency only. Not a rules-accurate Magic simulator and not a gameplay win-rate claim.'
  };
}

function readComparison(id) {
  const clean = safeId(id);
  if (!clean) return null;
  const file = path.join(PRODUCT_ROOT, clean + '.json');
  if (!fs.existsSync(file)) return null;
  const product = json(file);
  if (product.silo !== 'mtg' || product.status !== 'published') return null;
  const relative = product.edh_pipeline?.deck_manifest_file || product.deck_manifest_file;
  if (!relative) return null;
  const manifest = path.resolve(ROOT, relative);
  if (!manifest.startsWith(ROOT + path.sep) || !fs.existsSync(manifest)) return null;
  const deck = json(manifest);
  return { id: clean, deck };
}

function primer(deck, comparisons) {
  const commander = deck.cards.find(card => /legendary creature/i.test(card.type_line))?.name || deck.cards[0]?.name || deck.name;
  const lines = comparisons.map(item => `- ${item.id}: ${(item.result.estimated_win_rate * 100).toFixed(1)}% estimated comparative score`).join('\n') || '- No comparison deck supplied.';
  return [
    '# ' + deck.name,
    '',
    '## What the deck does',
    `A Commander deck centered on ${commander}, using the normalized card list as the source of truth.`,
    '', '## Commander and core plan',
    `Primary identity: ${commander}. The pipeline derives strategy from card data and does not invent unsupported combos.`,
    '', '## Early-game priorities',
    'Establish mana, develop card advantage, and preserve interaction around the deck\'s strongest axis.',
    '', '## Interaction and protection',
    'Prioritize identified interaction and protection cards before committing resources to secondary lines.',
    '', '## Mulligan guidance',
    'Prefer opening hands with adequate mana plus at least one engine, ramp, draw, or interaction signal.',
    '', '## Benchmark snapshot',
    lines,
    '', '## Strengths and trade-offs',
    'Strengths and trade-offs are bounded by the normalized evidence and fixture benchmark. Do not treat the benchmark as rules-accurate gameplay evidence.',
    '', '## Provenance and simulation caveat',
    `Source: ${deck.source_url}`,
    'Simulation: FIXTURE_BENCHMARK. Not a rules-accurate Magic simulator.'
  ].join('\n');
}

function write(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, value, 'utf8');
}

async function createJob(input) {
  const url = sourceUrl(input.source_url);
  const raw = await fetchSource(url);
  const sourceHash = hash(raw);
  const idempotencyKey = hash(url.hostname + url.href + sourceHash + PIPELINE_VERSION);
  const jobId = 'edh_job_' + idempotencyKey.slice(0, 20);
  const jobDir = path.join(JOB_ROOT, jobId);
  fs.mkdirSync(jobDir, { recursive: true });
  const cards = await enrich(parseDeck(raw));
  const normalized = {
    schema_version: 'edh-normalized-deck-v1',
    pipeline_version: PIPELINE_VERSION,
    name: String(input.name || url.pathname.split('/').filter(Boolean).pop() || 'Commander Deck').slice(0, 120),
    source_url: url.href,
    source_host: url.hostname.toLowerCase(),
    source_retrieved_at: iso(),
    source_content_sha256: sourceHash,
    cards,
    total_cards: cards.reduce((sum, card) => sum + card.quantity, 0),
    colors: [...new Set(cards.flatMap(card => card.color_identity || []))].sort()
  };
  const comparisonIds = Array.isArray(input.comparison_product_ids) ? input.comparison_product_ids.map(safeId).filter(Boolean).slice(0, 5) : [];
  const comparisons = [];
  for (const id of comparisonIds) {
    const comparison = readComparison(id);
    if (comparison) comparisons.push({ id, result: monteCarlo(cards, comparison.deck.cards || [], 20260831 + comparisons.length, 5000) });
  }
  const primerText = primer(normalized, comparisons);
  const productId = 'EDH_' + sourceHash.slice(0, 10).toUpperCase();
  const deckFile = path.join(jobDir, 'deck.json');
  const benchmarkFile = path.join(jobDir, 'benchmark.json');
  const primerFile = path.join(jobDir, 'primer.md');
  const heroPromptFile = path.join(jobDir, 'hero-prompt.txt');
  const heroPrompt = `Premium Commander deck product hero for ${normalized.name}. Use only supplied commander, colors, theme and selected card identities. Cinematic collector presentation. Do not reproduce official card text, Magic logos, or imply official artwork.`;
  write(deckFile, JSON.stringify(normalized, null, 2) + '\n');
  write(benchmarkFile, JSON.stringify({ schema_version: 'edh-benchmark-manifest-v1', comparisons }, null, 2) + '\n');
  write(primerFile, primerText + '\n');
  write(heroPromptFile, heroPrompt + '\n');

  const product = {
    id: productId,
    silo: 'mtg',
    name: normalized.name + ' Commander Deck',
    description: 'One-link EDH product package with normalized deck data, comparative benchmark, evidence-first primer and hero-media recipe.',
    price: 0,
    currency: 'nzd',
    inventory: 0,
    inventory_type: 'physical',
    status: 'draft',
    commercial_truth: { approval_required: true, sellable: false, activation_gate: 'EXPLICIT_OPERATOR_APPROVAL' },
    edh_pipeline: {
      pipeline_version: PIPELINE_VERSION,
      source_url: normalized.source_url,
      deck_manifest_file: path.relative(ROOT, deckFile).replace(/\\/g, '/'),
      benchmark_file: path.relative(ROOT, benchmarkFile).replace(/\\/g, '/'),
      primer_file: path.relative(ROOT, primerFile).replace(/\\/g, '/'),
      hero_prompt_file: path.relative(ROOT, heroPromptFile).replace(/\\/g, '/'),
      media_status: 'PROMPT_READY',
      cinema_sku: comparisons.length ? 'CINEMA_' + productId : null,
      comparison_ids: comparisons.map(item => item.id)
    },
    created_at: iso()
  };
  write(path.join(PRODUCT_ROOT, productId + '.json'), JSON.stringify(product, null, 2) + '\n');

  const proof = {
    schema_version: 'edh-one-link-proof-v1',
    job_id: jobId,
    product_id: productId,
    state: 'CATALOGUE_READY_DRAFT',
    source_url: normalized.source_url,
    source_sha256: sourceHash,
    normalized_deck_sha256: hash(JSON.stringify(normalized)),
    comparison_ids: comparisonIds,
    benchmark_type: 'FIXTURE_BENCHMARK',
    primer_sha256: hash(primerText),
    hero_prompt_sha256: hash(heroPrompt),
    media_status: 'PROMPT_READY',
    generated_at: iso(),
    approval_required: true
  };
  write(path.join(jobDir, 'PROOF.json'), JSON.stringify(proof, null, 2) + '\n');
  write(path.join(jobDir, 'STATE.json'), JSON.stringify({ status: 'CATALOGUE_READY', updated_at: iso(), product_id: productId }, null, 2) + '\n');
  return proof;
}

function readJob(jobId) {
  const clean = safeId(jobId);
  const file = path.join(JOB_ROOT, clean, 'PROOF.json');
  if (!clean || !file.startsWith(JOB_ROOT + path.sep) || !fs.existsSync(file)) return null;
  return json(file);
}

module.exports = { createJob, readJob, PIPELINE_VERSION };
