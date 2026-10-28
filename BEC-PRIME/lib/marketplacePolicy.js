'use strict';

const PLATFORM_SELLER_ID = 'HappyHomarid';
const EXTERNAL_RATE = 0.05;
const ZERO_FEE_SILOS = new Set(['MTG', 'SILO_MTG', 'MAGIC', 'MAGIC_THE_GATHERING', 'MARKETPLACE', 'B2B', 'RIVET']);

function calculateMarketplaceFee(seller, silo, amountNzd) {
  const amount = Number(amountNzd);
  if (!Number.isFinite(amount) || amount < 0) throw new Error('amountNzd must be a non-negative number');
  const normalizedSeller = String(seller || PLATFORM_SELLER_ID).trim() || PLATFORM_SELLER_ID;
  const normalizedSilo = String(silo || 'MARKETPLACE').trim().toUpperCase();
  const zeroFee = ZERO_FEE_SILOS.has(normalizedSilo) || normalizedSeller === PLATFORM_SELLER_ID;
  const percentage = zeroFee ? 0 : 5;
  const feeAmount = Math.round(amount * (zeroFee ? 0 : EXTERNAL_RATE) * 100) / 100;
  return {
    seller: normalizedSeller,
    silo: normalizedSilo,
    percentage,
    fee_amount: feeAmount,
    net_to_seller: Math.round((amount - feeAmount) * 100) / 100,
    rule: ZERO_FEE_SILOS.has(normalizedSilo) ? 'MTG_ZERO_PLATFORM_FEE' : (normalizedSeller === PLATFORM_SELLER_ID ? 'PLATFORM_SELLER_ZERO_PLATFORM_FEE' : 'EXTERNAL_SELLER_FIVE_PERCENT'),
    calculation: `${amount.toFixed(2)} * ${percentage / 100} = ${feeAmount.toFixed(2)}`
  };
}



// Candidate zero-upfront multi-lane pricing contract. This is a QUOTE only.
// Existing legacy fee bindings remain unchanged until signed seller agreements
// and live payment / payout reconciliation are approved and deployed.
// A2A here is AGENT-TO-AGENT; P2P is person-to-person.
// Existing universal peer zero-fee contract remains authoritative.
const UNIVERSAL_LANES = Object.freeze({
  B2B:{rateBasisPoints:0, capMinor:0},
  P2P:{rateBasisPoints:0, capMinor:0},
  A2A:{rateBasisPoints:100, capMinor:500}
});
function quoteUniversalMarketplaceFee(input){
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('FEE_INPUT_REQUIRED');
  const lane=String(input.lane||'').toUpperCase();
  const rule=UNIVERSAL_LANES[lane];
  if (!rule) throw new Error('UNKNOWN_MARKETPLACE_LANE_HOLD');
  const minor=input.amountMinor;
  if (!Number.isSafeInteger(minor) || minor<0 || minor>100000000) throw new Error('AMOUNT_MINOR_INVALID');
  if (input.currency !== 'NZD') throw new Error('FX_AND_CURRENCY_NOT_ENABLED');
  const sourceCountry=String(input.sellerCountry||'').toUpperCase();
  if (!/^[A-Z]{2}$/.test(sourceCountry)) throw new Error('COUNTRY_REQUIRED');
  const feeMinor=Math.min(rule.capMinor,Math.floor((minor*rule.rateBasisPoints+5000)/10000));
  return {
    schema:'BECK/MARKETPLACE-FEE-QUOTE/v1',
    lane,amountMinor:minor,currency:'NZD',sellerCountry:sourceCountry,
    platformFeeMinor:feeMinor,platformFeeBasisPoints:rule.rateBasisPoints,
    capMinor:rule.capMinor,netBeforeProviderCostsMinor:minor-feeMinor,
    listingPlatformFeeMinor:0,
    processingFeesIncluded:false,payoutFeesIncluded:false,taxesIncluded:false,
    crossBorderPayoutsApproved:false,
    globalDiscoveryAllowed:true,
    sellerVerificationRequired:true,
    auctionBidAuthority:false,externalCheckoutAuthority:false,
    approvalRequired:true,pricingState:'CANDIDATE_NOT_PUBLIC_OFFER',
    paymentRail:'UNVERIFIED',stripeConnectOnboarding:'NOT_VERIFIED'
  };
}

module.exports = { PLATFORM_SELLER_ID, EXTERNAL_RATE, ZERO_FEE_SILOS, calculateMarketplaceFee, UNIVERSAL_LANES, quoteUniversalMarketplaceFee };
