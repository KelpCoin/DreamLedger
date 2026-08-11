'use strict';

const fs = require('fs');
const path = require('path');
const ucp = require('../ucp');

const ROOT = path.join(__dirname, '..');
const offers = JSON.parse(fs.readFileSync(path.join(ROOT, 'catalog', 'offers', 'offers.json'), 'utf8')).offers || [];
const profile = ucp.profile();
const errors = [];

if (profile.ucp.version !== ucp.VERSION) errors.push('profile version mismatch');
if (!profile.ucp.services['dev.ucp.shopping']) errors.push('shopping service missing');
const service = profile.ucp.services['dev.ucp.shopping'];
if (service.rest?.endpoint !== 'https://dreamledger.org/ucp/v1') errors.push('REST endpoint mismatch');
const checkout = profile.ucp.capabilities.find(x => x.name === 'dev.ucp.shopping.checkout');
if (!checkout) errors.push('checkout capability missing');
if (checkout?.version !== ucp.VERSION) errors.push('checkout capability version mismatch');
if (!checkout?.schema?.includes(`/schemas/shopping/checkout.json`)) errors.push('checkout schema mismatch');
if (!offers.length) errors.push('canonical offer catalog empty');
if (offers.some(x => x.approval_required !== true || x.checkout_available !== false)) errors.push('canonical offer activation boundary changed unexpectedly');
if (profile.payment) errors.push('profile must not invent payment handlers');

const result = {
  schema: 'BEC-PRIME/UCP-TRUTH-PROOF/v1',
  verdict: errors.length ? 'FAIL' : 'PASS',
  ucp_version: ucp.VERSION,
  profile_endpoint: service.rest?.endpoint || null,
  checkout_capability: checkout || null,
  canonical_offer_count: offers.length,
  all_offers_locked: offers.every(x => x.approval_required === true && x.checkout_available === false),
  errors
};
console.log(JSON.stringify(result, null, 2));
process.exit(errors.length ? 1 : 0);
