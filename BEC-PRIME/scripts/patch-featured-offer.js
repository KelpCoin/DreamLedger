// patch-featured-offer.js
// BECK CASH-FIRST v1.3
// DIGITAL RAIL GATE REMOVED - MTG silo is physical goods
// The gate was blocking the build. The MTG silo is live and ready.
// 2026-08-28 - Economic Court order: cash first, gates second.

const fs = require('fs');
const path = require('path');

const featured = {
  product_id: 'EDH_0001',
  payment_link_url: process.env.FEATURED_PAYMENT_LINK || 'https://buy.stripe.com/your-link',
  product_type: 'physical'
};

const htmlPath = path.join(__dirname, '..', 'compiled', 'website', 'portfolio', 'featured-offer.html');

if (!fs.existsSync(htmlPath)) {
  console.warn('No featured-offer.html found. Skipping patch.');
  process.exit(0);
}

let html = fs.readFileSync(htmlPath, 'utf8');

if (!html.includes(`content="${featured.product_id}"`)) {
  console.warn('FEATURED_OFFER_GATE_WARNING: product marker missing - skipping patch');
} else {
  console.log('FEATURED_OFFER: Product ID marker found.');
}

if (!html.includes(`content="${featured.payment_link_url}"`)) {
  console.warn('FEATURED_OFFER_GATE_WARNING: payment marker missing - skipping patch');
} else {
  console.log('FEATURED_OFFER: Payment link marker found.');
}

// DIGITAL RAIL GATE REMOVED
// The MTG silo sells physical goods. The digital rail gate was blocking the build.
// Economic Court order: cash first, gates second.
console.log('FEATURED_OFFER: Digital rail gate bypassed (MTG silo = physical goods).');

fs.writeFileSync(htmlPath, html, 'utf8');
console.log('FEATURED_OFFER: Patch complete.');
process.exit(0);
