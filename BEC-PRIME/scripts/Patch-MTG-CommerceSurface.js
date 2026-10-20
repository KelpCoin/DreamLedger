'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SOURCE = path.join(ROOT, 'website', 'mtg-catalog.html');
const PROOF = path.join(ROOT, 'PROOF-MTG-COMMERCE-SURFACE.json');
const MARKER = 'data-dreamledger-mtg-commerce-v2';

function writeProof(contract) {
  const proof = {
    schema: 'BEC-PRIME/MTG-COMMERCE-SURFACE/v3',
    status: 'PASS',
    source: 'BEC-PRIME/website/mtg-catalog.html',
    marker: MARKER,
    route: '/mtg',
    aliases: ['/mtg', '/mtg/', '/MTG', '/MTG/'],
    catalogue: '/data/mtg-catalog.json',
    render_contract: contract,
    claims: {
      revenue: 'NOT_ASSERTED',
      checkout_to_fulfillment: 'NOT_PROVEN_BY_SURFACE_PATCH',
      inventory: 'MUST_BE_READ_FROM_CATALOGUE',
      publish_gate: 'HUMAN_APPROVAL_REQUIRED'
    },
    generated_at: new Date().toISOString()
  };
  fs.writeFileSync(PROOF, JSON.stringify(proof, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify(proof, null, 2));
}

function hasCurrentResponsiveCardContract(html) {
  const required = [
    'id="grid"',
    'id="status"',
    "const CATALOG='/data/mtg-catalog.json';",
    'async function load(){',
    'data.products||[]',
    'p.inventory',
    'p.name',
    'p.price',
    'Open full card grid',
    'View listing'
  ];
  const missing = required.filter(fragment => !html.includes(fragment));
  return { ok: missing.length === 0, missing };
}

function patchLegacyRenderer(html) {
  const start = html.indexOf('function render(items){');
  const end = html.indexOf('async function load(){', start);
  if (start < 0 || end < 0) return { html, patched: false };

  const render = String.raw`function render(items){
const decks=items.filter(isMtg);
const live=decks.filter(p=>String(p.status).toLowerCase()==='published');
const units=decks.reduce((n,p)=>n+(Number(p.inventory)||0),0);
count.textContent=decks.length;
published.textContent=live.length;
stock.textContent=units;
status.textContent=decks.length?'Discovered MTG records: '+decks.length:'No MTG records discovered.';
rail.innerHTML=decks.map((p,i)=>{
  const purchasable=String(p.status).toLowerCase()==='published'&&(Number(p.inventory)||0)>0;
  const priceUnit=String(p.price_unit||'').toLowerCase();
  const priceMajor=(priceUnit==='minor'||priceUnit==='cents')?Number(p.price)/100:Number(p.price);
  const image=p.image_url||p.imageUrl||p.image||'';
  const kind=String(p.product_kind||p.category||p.inventory_type||'').toLowerCase();
  const conditionEligible=['single','single-card','mtg-single','physical-single'].includes(kind);
  const condition=conditionEligible&&typeof p.condition==='string'&&p.condition.trim()?p.condition.trim():'';
  const title=String(p.hero_headline||p.name||p.id||'MTG listing');
  const subtitle=String(p.hero_subtitle||p.description||'');
  const primaryLabel=String(p.cta_label||(purchasable?'View listing':'Listing unavailable'));
  return '<article class="card"><div class="art '+(image?'has-image':'')+'">'+(image?'<img src="'+esc(image)+'" alt="'+esc(title)+'" loading="lazy">':'')+'<div class="sigil">'+esc(p.hero_badge||'MTG LISTING')+'</div></div><div class="body"><h2>'+esc(title)+'</h2><div class="desc">'+esc(subtitle)+'</div><div class="row"><span>'+esc(condition)+'</span><span>NZ$'+(Number.isFinite(priceMajor)?priceMajor.toFixed(2):'Price on listing')+'</span></div><div class="row"><span class="'+(purchasable?'ok':'wait')+'">'+(purchasable?'IN STOCK':'NOT CURRENTLY PURCHASABLE')+'</span><span>'+esc(p.inventory==null?'Availability unverified':p.inventory+' units')+'</span></div><a class="buy mtg-buy" '+(purchasable?'':'aria-disabled="true"')+' href="'+esc(p.detail_url||p.claim_url||'/mtg/')+'">'+esc(primaryLabel)+'</a></div></article>';
}).join('');
}`;

  let result = html.slice(0, start) + render + html.slice(end);
  result = result.replace(
    '.rail{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px;padding:10px 0 18px}',
    '.rail{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,260px),1fr));gap:14px;padding:10px 0 22px}.art.has-image{position:relative;overflow:hidden}.art.has-image img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.88}'
  );
  return { html: result, patched: result !== html };
}

function patch() {
  let html = fs.readFileSync(SOURCE, 'utf8');
  if (html.includes(MARKER)) {
    const contract = html.includes('Open full card grid') ? 'RESPONSIVE_PRODUCT_CARD_GRID' : 'LEGACY_MTG_RENDERER';
    writeProof(contract);
    return;
  }

  const legacy = patchLegacyRenderer(html);
  let contract = 'LEGACY_MTG_RENDERER';
  if (legacy.patched) {
    html = legacy.html;
  } else {
    const current = hasCurrentResponsiveCardContract(html);
    if (!current.ok) {
      throw new Error('MTG render contract unsupported. Missing required fragments: ' + current.missing.join(', '));
    }
    // The canonical page was already migrated to a responsive card renderer.
    // Do not overwrite that implementation with an obsolete legacy renderer.
    contract = 'RESPONSIVE_PRODUCT_CARD_GRID';
  }

  html = html.replace(/<body\b([^>]*)>/i, (whole, attrs) => {
    if (attrs.includes(MARKER)) return whole;
    return '<body' + attrs + ' ' + MARKER + '>';
  });

  if (!html.includes(MARKER)) throw new Error('Failed to mark verified MTG surface');
  fs.writeFileSync(SOURCE, html, 'utf8');
  writeProof(contract);
}

patch();
