const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const AUCTION_DATA = path.resolve(process.env.AUCTION_DATA_PATH || path.join(__dirname, 'data', 'auctions.json'));
const AUCTION_PROOFS = path.resolve(process.env.AUCTION_PROOF_DIR || path.join(__dirname, 'data', 'proofs', 'auctions'));
fs.mkdirSync(path.dirname(AUCTION_DATA), { recursive: true });
fs.mkdirSync(AUCTION_PROOFS, { recursive: true });

function loadState() {
  if (!fs.existsSync(AUCTION_DATA)) return { auctions: [], bids: [] };
  const state = JSON.parse(fs.readFileSync(AUCTION_DATA, 'utf8'));
  return { auctions: Array.isArray(state.auctions) ? state.auctions : [], bids: Array.isArray(state.bids) ? state.bids : [] };
}
function saveState(state) { fs.writeFileSync(AUCTION_DATA, JSON.stringify(state, null, 2) + '\n'); }
function now() { return Date.now(); }
function publicAuction(a, bids) {
  const auctionBids = bids.filter(b => b.auction_id === a.auction_id).sort((x, y) => y.amount - x.amount || x.created_at - y.created_at);
  const top = auctionBids[0] || null;
  const ended = now() >= a.ends_at || a.status === 'ended';
  const reserveMet = Number(a.reserve_price || 0) === 0 || Number(top?.amount || 0) >= Number(a.reserve_price || 0);
  const status = ended ? 'ended' : a.status;
  return {
    auction_id: a.auction_id, product_id: a.product_id, silo: a.silo, title: a.title, description: a.description,
    currency: a.currency, start_price: a.start_price, current_price: top?.amount || a.start_price, reserve_price: a.reserve_price,
    reserve_met: reserveMet, minimum_increment: a.minimum_increment, buy_now_price: a.buy_now_price || null,
    starts_at: a.starts_at, ends_at: a.ends_at, status, bid_count: auctionBids.length,
    bidder_count: new Set(auctionBids.map(b => b.bidder_id)).size,
    highest_bidder: top?.bidder_id ? `bidder-${crypto.createHash('sha256').update(top.bidder_id).digest('hex').slice(0, 8)}` : null,
    approval_required: a.approval_required === true,
    checkout_available: false, seller_verified: a.seller_verified === true, approved: a.approved === true, gauntlet_verdict: a.gauntlet_verdict === 'ALLOW' ? 'ALLOW' : 'HOLD',
    anti_sniping_seconds: a.anti_sniping_seconds
  };
}
function createAuction(input) {
  if (!input || !input.silo || !input.title) throw new Error('silo and title are required');
  const state = loadState();
  const auction = {
    auction_id: input.auction_id || `AUC-${crypto.randomUUID().toUpperCase()}`,
    product_id: input.product_id || null, silo: String(input.silo), title: String(input.title), description: String(input.description || ''),
    currency: String(input.currency || 'NZD').toUpperCase(), start_price: Number(input.start_price), reserve_price: Number(input.reserve_price || 0),
    minimum_increment: Number(input.minimum_increment || 1), buy_now_price: input.buy_now_price == null ? null : Number(input.buy_now_price),
    starts_at: Number(input.starts_at || now()), ends_at: Number(input.ends_at), anti_sniping_seconds: Number(input.anti_sniping_seconds || 120),
    status: 'scheduled', approval_required: input.approval_required !== false, checkout_available: input.checkout_available === true
  };
  if (!Number.isFinite(auction.start_price) || auction.start_price <= 0) throw new Error('start_price must be positive');
  if (!Number.isFinite(auction.ends_at) || auction.ends_at <= auction.starts_at) throw new Error('ends_at must be after starts_at');
  if (state.auctions.some(x => x.auction_id === auction.auction_id)) throw new Error('auction_id already exists');
  state.auctions.push(auction); saveState(state); return publicAuction(auction, state.bids);
}
function placeBid() {
  throw new Error('AUTHENTICATED_NEON_BID_EXECUTOR_REQUIRED');
}
function listAuctions(silo) {
  const state = loadState();
  return state.auctions.filter(a =>
    (!silo || a.silo===silo) && a.approved === true &&
    a.seller_verified === true && a.gauntlet_verdict === 'ALLOW' &&
    a.status === 'APPROVED' && Number(a.ends_at)>now()
  ).map(a => publicAuction(a,state.bids));
}
function getAuction(id) {return listAuctions().find(a=>a.auction_id===id)||null;}
module.exports = { createAuction, placeBid, listAuctions, getAuction, AUCTION_DATA, AUCTION_PROOFS };
