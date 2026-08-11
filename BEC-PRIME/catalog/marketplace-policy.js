const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const POLICY_PATH = path.join(ROOT, 'config', 'marketplace-fees.json');

function loadPolicy() {
  return JSON.parse(fs.readFileSync(POLICY_PATH, 'utf8'));
}

function getPlatformFeeBps(sellerName, silo) {
  const policy = loadPolicy();
  if (sellerName === 'HappyHomarid Master Sellers' && silo === 'SILO_MTG') {
    return 0;
  }
  return Number(policy.default_platform_fee_bps || 500);
}

function calculateFee(amountMinor, sellerName, silo) {
  const amount = Math.max(0, Number(amountMinor) || 0);
  const bps = getPlatformFeeBps(sellerName, silo);
  return Math.floor(amount * bps / 10000);
}

module.exports = {
  loadPolicy,
  getPlatformFeeBps,
  calculateFee
};
