'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const JOB_ROOT = path.join(ROOT, 'data', 'mtg', 'edh-jobs');
const PRODUCT_ROOT = path.join(ROOT, 'catalog', 'products');

function hash(value) { return crypto.createHash('sha256').update(String(value)).digest('hex'); }
function read(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function write(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, value, 'utf8'); }
function esc(value) { return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

function heroSvg(deck) {
  const colors = (deck.colors || []).join(' ') || 'Colorless';
  const commander = deck.cards.find(card => /legendary creature/i.test(card.type_line))?.name || deck.cards[0]?.name || deck.name;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900">\n<defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#10131b"/><stop offset="0.55" stop-color="#3b4254"/><stop offset="1" stop-color="#0b0d12"/></linearGradient></defs>\n<rect width="1600" height="900" fill="url(#g)"/>\n<circle cx="1250" cy="260" r="260" fill="none" stroke="#d7dce7" stroke-opacity="0.25" stroke-width="3"/>\n<circle cx="1250" cy="260" r="180" fill="none" stroke="#d7dce7" stroke-opacity="0.16" stroke-width="2"/>\n<text x="110" y="150" fill="#ffffff" font-family="Arial, sans-serif" font-size="34" letter-spacing="5">DREAMLEDGER / EDH</text>\n<text x="110" y="280" fill="#ffffff" font-family="Arial, sans-serif" font-size="72" font-weight="700">${esc(deck.name)}</text>\n<text x="110" y="350" fill="#d7dce7" font-family="Arial, sans-serif" font-size="38">${esc(commander)}</text>\n<text x="110" y="420" fill="#aeb6c7" font-family="Arial, sans-serif" font-size="26">${esc(colors)}  •  ${deck.total_cards} cards</text>\n<text x="110" y="790" fill="#8f98aa" font-family="Arial, sans-serif" font-size="20">GENERATED PRODUCT MEDIA • NOT OFFICIAL MAGIC ARTWORK</text>\n</svg>\n`;
}

async function attachHero(proof) {
  const jobDir = path.join(JOB_ROOT, proof.job_id);
  const deck = read(path.join(jobDir, 'deck.json'));
  const heroFile = path.join(jobDir, 'hero.svg');
  write(heroFile, heroSvg(deck));
  const productFile = path.join(PRODUCT_ROOT, proof.product_id + '.json');
  const product = read(productFile);
  product.edh_pipeline = product.edh_pipeline || {};
  product.edh_pipeline.hero_asset_file = path.relative(ROOT, heroFile).replace(/\\/g, '/');
  product.edh_pipeline.media_status = 'HERO_READY';
  write(productFile, JSON.stringify(product, null, 2) + '\n');
  const proofFile = path.join(jobDir, 'PROOF.json');
  const updated = read(proofFile);
  updated.hero_asset_sha256 = hash(fs.readFileSync(heroFile));
  updated.media_status = 'HERO_READY';
  updated.updated_at = new Date().toISOString();
  write(proofFile, JSON.stringify(updated, null, 2) + '\n');
  return updated;
}

module.exports = { attachHero };
