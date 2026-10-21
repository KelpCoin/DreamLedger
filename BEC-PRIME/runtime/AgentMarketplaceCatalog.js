'use strict';
/*
 * Read-only agent discovery over existing MTG master + peer listings.
 * No new inventory database, checkout, financial ledger, Stripe action or
 * claim that listings are externally available. Never disclose seller PII.
 */
const fs = require('fs');
const path = require('path');
const DATA_ROOT = process.env.DREAMIEZ_DATA_DIR ||
  ((fs.existsSync('/var/data') && fs.statSync('/var/data').isDirectory()) ?
    '/var/data/dreamiez' : path.join(__dirname, '..', 'data', 'dreamiez'));
const MASTER_PATH = path.resolve(__dirname, '..', '..', 'data', 'mtg-catalog.json');
const PEER_PATH = path.join(DATA_ROOT, 'mtg-marketplace-listings.json');

function source(file, fallback) {
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    return {status:'OBSERVED', data};
  } catch {
    return {status:'UNOBSERVABLE', data:fallback};
  }
}
function str(v, max=180) {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}
function safePage(v) {
  const s = str(v, 320);
  return /^\/mtg\/[A-Za-z0-9/_-]+(?:\.html)?$/.test(s) ? s : null;
}
function safeImage(v) {
  const s = str(v, 1000);
  try {
    const u = new URL(s);
    return u.protocol === 'https:' && !u.username && !u.password ? s : null;
  } catch { return null; }
}
function money(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 && n <= 1000000 ?
    Math.round(n * 100) : null;
}
function base(id, title, description, minor, detailUrl, sourceType, sourceId, image) {
  return {
    id, source_id:sourceId, silo_id:'mtg',
    title:str(title), description:str(description, 700),
    price:minor === null ? null : {amount_minor:minor, currency:'NZD'},
    image_url:safeImage(image),
    detail_url:safePage(detailUrl),
    source_type:sourceType,
    availability:'SELLER_CONFIRMATION_REQUIRED',
    economic_state:'DISCOVERY_ONLY',
    purchase_authority:'EXPLICIT_HUMAN_AUTHORIZATION_REQUIRED',
    checkout:{available:false, reason:'PRODUCTION_PAYMENT_AND_DELIVERY_NOT_VERIFIED'}
  };
}
function buildCatalog(master={}, peers=[], sourceState={master:'OBSERVED',peer:'OBSERVED'}) {
  const products = master && master.silo === 'mtg' && Array.isArray(master.products) ?
    master.products : [];
  const entries=[];
  const seen=new Set();
  for (const p of products) {
    if (!p || p.silo !== 'mtg' || p.status !== 'published' ||
        p.category !== 'commander-deck' || !(Number(p.inventory) > 0) ||
        money(p.price) === null || !str(p.id, 120)) continue;
    const id='mtg:master:'+str(p.id,120);
    if(seen.has(id)) continue;
    seen.add(id);
    entries.push({...base(id,p.name,p.description,money(p.price),p.detail_url,
      'MTG_MASTER_CATALOG',str(p.id,120),p.image_url),
      seller:{display_name:'Marketplace catalogue',trader_status:'UNVERIFIED'},
      claimed_quantity:Math.min(999,Math.trunc(Number(p.inventory))),
      listing_type:'PHYSICAL_DECK',
      supported_actions:['VIEW_LISTING','REQUEST_SELLER_CONFIRMATION']});
  }
  for (const p of Array.isArray(peers) ? peers : []) {
    if (!p || p.status !== 'active' || !p.id ||
        (!p.accepts_buy && !p.accepts_trade) ||
        (p.silo_id && p.silo_id !== 'mtg')) continue;
    const minor=p.accepts_buy ? money(p.price_nzd) : null;
    if(p.accepts_buy && minor === null) continue;
    const id='mtg:peer:'+str(p.id,120);
    if(seen.has(id)) continue;
    seen.add(id);
    entries.push({...base(id,p.title,p.description,minor,
      '/mtg/', 'MTG_PEER_MARKETPLACE',str(p.id,120),p.image_url),
      seller:{display_name:str(p.seller_display_name || 'Member',80),
              trader_status:['trader','private'].includes(p.trader_status)?p.trader_status:'UNVERIFIED'},
      claimed_quantity:null,
      listing_type:'MTG_SINGLE',
      accepts_buy:p.accepts_buy === true,
      accepts_trade:p.accepts_trade === true,
      supported_actions:['VIEW_LISTING','REQUEST_SELLER_CONFIRMATION']});
  }
  return {
    schema:'dreamledger.marketplace.agent_catalog.v1',
    silo_id:'mtg', currency:'NZD',
    source_state:{master:sourceState.master || 'UNOBSERVABLE',
                  peer:sourceState.peer || 'UNOBSERVABLE'},
    total:entries.length,
    listings:entries.slice(0,100),
    fees:{listing_nzd:0,platform_success_nzd:0},
    payment_enabled:false,
    agent_permissions:{discovery:true,cart_preparation:'AUTHENTICATED_EXISTING_MARKETPLACE_ONLY',
                       purchase:false,autonomous_spend:false},
    truth_rule:'A listing is not proof of inventory, settlement, fulfillment or delivery.',
    protocol_status:{ucp:'NOT_IMPLEMENTED',ap2:'NOT_IMPLEMENTED'}
  };
}
function snapshot() {
  const m=source(MASTER_PATH,{silo:'mtg',products:[]});
  const p=source(PEER_PATH,[]);
  return buildCatalog(m.data,p.data,{master:m.status,peer:p.status});
}
module.exports={buildCatalog,snapshot,paths:{MASTER_PATH,PEER_PATH}};
