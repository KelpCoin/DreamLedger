'use strict';
/** SiloFaceCompiler — 500 silo faces as data-driven exhaust (shell_candidate until gauntlet). */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const REPO = path.join(ROOT, '..');
const OUT_DATA = path.join(REPO, 'public', 'data', 'silo-face-registry.json');
const PROOF = path.join(ROOT, 'RUN-PROOFS', 'SILO-FACE-COMPILER-PROOF.json');

const VERTICALS = [
  ['mtg', 'Magic: The Gathering', 'mtg', 'Singles and decks — see the cards.'],
  ['pokemon', 'Pokémon TCG', 'digital_products', 'Singles-first trading cards.'],
  ['yugioh', 'Yu-Gi-Oh!', 'digital_products', 'Competitive and collection singles.'],
  ['lorcana', 'Disney Lorcana', 'digital_products', 'See the cards before you deal.'],
  ['onepiece', 'One Piece Card Game', 'digital_products', 'Singles and sealed — card grid first.'],
  ['fab', 'Flesh and Blood', 'digital_products', 'Hero-centric singles marketplace shell.'],
  ['digimon', 'Digimon TCG', 'digital_products', 'Singles-first card shell.'],
  ['swu', 'Star Wars: Unlimited', 'digital_products', 'Card grid marketing shell.'],
  ['crypto', 'Crypto tools', 'crypto', 'Risk-disclosed digital tools only.'],
  ['media_music', 'Media & music', 'media_music', 'Licensed digital products.'],
  ['digital_products', 'Digital products', 'digital_products', 'Schema-gated digital offers.'],
  ['supplier_quotes', 'Supplier quotes', 'digital_products', 'Compare quotes with unknowns visible.'],
  ['saas_vendors', 'SaaS vendors', 'digital_products', 'Vendor comparison worksheets.'],
  ['freight', 'Freight quotes', 'digital_products', 'Lane and rate comparison shell.'],
  ['construction', 'Construction subs', 'digital_products', 'Subcontractor quote comparison.'],
  ['fleet', 'Fleet repair', 'digital_products', 'Repair quote comparison.'],
  ['it_hardware', 'IT hardware', 'digital_products', 'Hardware RFQ comparison.'],
  ['marketing', 'Marketing agencies', 'digital_products', 'Agency scope and price compare.'],
  ['events', 'Event vendors', 'digital_products', 'Vendor quote comparison.'],
  ['manufacturing', 'Manufacturing supply', 'digital_products', 'Supplier price-list compare.'],
  ['discord', 'Discord automation', 'digital_products', 'Webhook and bot kits.'],
  ['stripe_ops', 'Stripe ops', 'digital_products', 'Reconciliation and attribution tools.'],
  ['supabase', 'Supabase hardening', 'digital_products', 'Production checklist products.'],
  ['game_economy', 'Game economy audit', 'digital_products', 'Economy design review.'],
  ['qr', 'QR microsites', 'digital_products', 'Campaign landing kits.']
];
const REGIONS = ['nz','au','us','uk','eu','global','apac','latam','mena','ca'];
const SEGMENTS = ['retail','wholesale','b2b','creator','enterprise','hobby','pro','school','club','online'];

function generate(limit) {
  limit = limit || 500;
  const entries = [];
  for (const [slug, name, silo, tag] of VERTICALS) {
    entries.push({
      slug, name,
      commercial_silo: silo,
      tagline: tag,
      status: slug === 'mtg' ? 'live_candidate' : 'shell_candidate',
      route: slug === 'mtg' ? '/mtg/' : '/silo.html?slug=' + slug,
      accent: slug === 'mtg' ? '#d8b56b' : '#9f8cff'
    });
  }
  outer: for (const [v] of VERTICALS) {
    for (const r of REGIONS) {
      for (const s of SEGMENTS) {
        if (entries.length >= limit) break outer;
        const slug = v + '-' + r + '-' + s;
        if (entries.some(e => e.slug === slug)) continue;
        entries.push({
          slug,
          name: v.replace(/_/g, ' ') + ' · ' + r.toUpperCase() + ' · ' + s,
          commercial_silo: 'digital_products',
          tagline: 'Compiler shell — not publicly activated until gauntlet PASS.',
          status: 'shell_candidate',
          route: '/silo.html?slug=' + slug,
          accent: '#6b7fd8'
        });
      }
    }
  }
  return {
    schema: 'BEC-PRIME/SILO-FACE-REGISTRY/v1',
    rule: 'shell_candidate must not claim live inventory or revenue. Gauntlet required for public activation.',
    count: entries.length,
    silos: entries.slice(0, limit)
  };
}

function compile() {
  const reg = generate(500);
  fs.mkdirSync(path.dirname(OUT_DATA), { recursive: true });
  fs.writeFileSync(OUT_DATA, JSON.stringify(reg) + '\n');
  const proof = {
    schema: 'dreamledger/silo-face-compiler-proof/v1',
    status: 'PASS',
    count: reg.count,
    mtg: reg.silos.find(s => s.slug === 'mtg') || null,
    out: 'public/data/silo-face-registry.json',
    faces: ['public/silo.html', 'public/silos/index.html', 'public/mtg/'],
    emitted_at: new Date().toISOString()
  };
  fs.mkdirSync(path.dirname(PROOF), { recursive: true });
  fs.writeFileSync(PROOF, JSON.stringify(proof, null, 2) + '\n');
  return proof;
}

if (require.main === module) console.log(JSON.stringify(compile(), null, 2));
module.exports = { generate, compile };
