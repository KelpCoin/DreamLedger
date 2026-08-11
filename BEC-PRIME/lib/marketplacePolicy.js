'use strict';

const PLATFORM_SELLER_ID = 'HappyHomarid';
const EXTERNAL_RATE = 0.05;

function calculateMarketplaceFee(seller, silo, amountNzd) {
  const amount = Number(amountNzd);
  if (!Number.isFinite(amount) || amount < 0) throw new Error('amountNzd must be a non-negative number');
  const normalizedSeller = String(seller || PLATFORM_SELLER_ID).trim() || PLATFORM_SELLER_ID;
  const zeroFee = normalizedSeller === PLATFORM_SELLER_ID;
  const percentage = zeroFee ? 0 : 5;
  const feeAmount = Math.round(amount * (zeroFee ? 0 : EXTERNAL_RATE) * 100) / 100;
  return {
    seller: normalizedSeller,
    silo: String(silo || 'SILO_MTG'),
    percentage,
    fee_amount: feeAmount,
    net_to_seller: Math.round((amount - feeAmount) * 100) / 100,
    rule: zeroFee ? 'HAPPYHOMARID_ZERO_PLATFORM_FEE' : 'EXTERNAL_SELLER_FIVE_PERCENT',
    calculation: `${amount.toFixed(2)} * ${percentage / 100} = ${feeAmount.toFixed(2)}`
  };
}

module.exports = { PLATFORM_SELLER_ID, EXTERNAL_RATE, calculateMarketplaceFee };
