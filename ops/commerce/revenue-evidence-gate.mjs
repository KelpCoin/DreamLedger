// Payment facts are not independent-buyer, delivery or net-margin evidence.
export function classifyEconomicEvidence(evidence = {}) {
  const processorPaid = evidence.checkoutLivemode === true &&
    evidence.checkoutPaid === true &&
    evidence.paymentIntentSucceeded === true &&
    evidence.chargeUnrefunded === true &&
    evidence.exactOfferMatched === true;
  const delivered = evidence.deliveryEvidenceVerified === true;
  const independent = evidence.independentBuyerVerified === true;
  const settlement = evidence.settlementEvidenceVerified === true;
  const costs = evidence.actualCostsMeasured === true;
  const verified = processorPaid && delivered && independent && settlement && costs;
  return Object.freeze({
    state: verified ? 'VERIFIED_EXTERNAL_COMMERCIAL_OUTCOME' :
      processorPaid ? 'PAID_PENDING_EXTERNAL_AND_DELIVERY_PROOF' : 'UNVERIFIED_PAYMENT',
    processor_payment_observed: processorPaid,
    verified_external_revenue: verified,
    verified_contribution_nzd: verified ? evidence.measuredContributionNzd ?? null : null,
    missing: [
      ...(!processorPaid ? ['processor_payment'] : []),
      ...(!independent ? ['independent_buyer'] : []),
      ...(!settlement ? ['settlement'] : []),
      ...(!delivered ? ['delivery'] : []),
      ...(!costs ? ['actual_costs'] : [])
    ]
  });
}
