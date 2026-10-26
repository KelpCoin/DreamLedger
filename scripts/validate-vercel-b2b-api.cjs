'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const required = [
  'api/marketplace/intake.ts',
  'api/marketplace/listings.ts',
  'api/marketplace/rfqs.ts',
  'api/marketplace/admin.ts',
  'api/marketplace/seller-intake.ts',
  'public/b2b-inbox.html',
  'public/b2b.html',
  'migrations/20261026_marketplace_multitenant_figure_eight.sql'
];
const missing = required.filter(p => !fs.existsSync(path.join(root, p)));
const intake = fs.existsSync(path.join(root, required[0])) ? fs.readFileSync(path.join(root, required[0]), 'utf8') : '';
const listings = fs.existsSync(path.join(root, required[1])) ? fs.readFileSync(path.join(root, required[1]), 'utf8') : '';
const rfqs = fs.existsSync(path.join(root, required[2])) ? fs.readFileSync(path.join(root, required[2]), 'utf8') : '';
const admin = fs.existsSync(path.join(root, required[3])) ? fs.readFileSync(path.join(root, required[3]), 'utf8') : '';
const inbox = fs.existsSync(path.join(root, required[4])) ? fs.readFileSync(path.join(root, required[4]), 'utf8') : '';
const migration = fs.existsSync(path.join(root, required[7])) ? fs.readFileSync(path.join(root, required[7]), 'utf8') : '';
const seller = fs.existsSync(path.join(root, 'api/marketplace/seller-intake.ts')) ? fs.readFileSync(path.join(root, 'api/marketplace/seller-intake.ts'), 'utf8') : '';
const sellPage = fs.existsSync(path.join(root, 'public/sell.html')) ? fs.readFileSync(path.join(root, 'public/sell.html'), 'utf8') : '';
const checks = {
  rfqConsent: /contact_consent/.test(intake),
  rfqIdempotency: /idempotency_key/.test(intake),
  rateLimit: /request_count<5/.test(intake),
  publishedListingsOnly: /status='published' and l\.quantity>0/.test(listings),
  openRfqsOnly: /status='open' and visibility='marketplace'/.test(rfqs),
  privateInboxAuth: /B2B_ADMIN_TOKEN/.test(admin) && /timingSafeEqual/.test(admin),
  privateInboxNoIndex: /noindex,nofollow/.test(inbox),
  sellerConsentRequired: /contact_consent/.test(seller) && /contact_consent/.test(sellPage),
  sellerPrivatePersistence: /marketplace\.public_seller_intake/.test(seller),
  sellerNoBrowserStorageFallback: !/localStorage/.test(sellPage),
  sellerIdempotency: /idempotency_key/.test(seller),
  tenantSchema: ['organizations','memberships','listings','rfqs','proposals','orders','public_rfq_intake','public_seller_intake'].every(t => migration.includes('marketplace.'+t))
};
const failed = Object.entries(checks).filter(([,v]) => !v).map(([k]) => k);
const result = {schema:'dreamledger/b2b-vercel-mvp-proof/v1',status:missing.length||failed.length?'FAIL':'PASS',checked_at:new Date().toISOString(),missing,failed,checks};
fs.writeFileSync(path.join(root,'PROOF-B2B-VERCEL-MVP.json'), JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
if(missing.length||failed.length)process.exit(1);
