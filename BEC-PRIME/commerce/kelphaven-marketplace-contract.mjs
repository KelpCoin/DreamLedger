/**
 * Kelphaven marketplace policy kernel.
 *
 * This is a deterministic policy module, not a database, payment processor,
 * production marketplace, or proof of deployment. It deliberately fails closed.
 * Elohim may propose; the Gauntlet independently evaluates; a human approves
 * publication and any irreversible commercial action.
 */

export const MARKETPLACE_NAME = "Kelphaven.n";
export const MARKETPLACE_VERSION = "0.2.0-evidence-gated-pipeline";

export const PRODUCT_STATES = Object.freeze({
  DRAFT: "DRAFT",
  PRICED_PENDING_GAUNTLET: "PRICED_PENDING_GAUNTLET",
  GAUNTLET_REJECTED: "GAUNTLET_REJECTED",
  READY_FOR_HUMAN_APPROVAL: "READY_FOR_HUMAN_APPROVAL",
  PUBLISHED: "PUBLISHED",
  PAUSED: "PAUSED",
});

export const TRADE_STATES = Object.freeze({
  INTENT: "INTENT",
  OFFER_ACCEPTED: "OFFER_ACCEPTED",
  PAYMENT_PENDING: "PAYMENT_PENDING",
  PAID_VERIFIED: "PAID_VERIFIED",
  FULFILLMENT_PENDING: "FULFILLMENT_PENDING",
  DELIVERED: "DELIVERED",
  DISPUTED: "DISPUTED",
  REFUNDED: "REFUNDED",
  CANCELLED: "CANCELLED",
});

const finitePositive = (value) => Number.isFinite(value) && value > 0;
const nonEmpty = (value) => typeof value === "string" && value.trim().length > 0;

/**
 * Elohim's output is a proposal only. All economic inputs must be sourced.
 * Amounts are NZD, exclusive of any taxes unless tax is explicitly included.
 */
export function proposePrice(candidate) {
  const errors = [];
  if (!candidate || typeof candidate !== "object") {
    return { status: "REJECTED", errors: ["CANDIDATE_REQUIRED"] };
  }

  if (!nonEmpty(candidate.sku)) errors.push("SKU_REQUIRED");
  if (!nonEmpty(candidate.siloId)) errors.push("SILO_ID_REQUIRED");
  if (!nonEmpty(candidate.currency) || candidate.currency.toLowerCase() !== "nzd") {
    errors.push("CURRENCY_MUST_BE_NZD");
  }
  if (!finitePositive(candidate.unitCostNzd)) errors.push("POSITIVE_UNIT_COST_REQUIRED");
  if (!finitePositive(candidate.targetMarginPct) || candidate.targetMarginPct >= 100) {
    errors.push("TARGET_MARGIN_MUST_BE_BETWEEN_0_AND_100");
  }
  if (!Array.isArray(candidate.evidence) || candidate.evidence.length < 1) {
    errors.push("PRICE_EVIDENCE_REQUIRED");
  } else {
    for (const [index, item] of candidate.evidence.entries()) {
      if (!nonEmpty(item?.source)) errors.push(`EVIDENCE_${index}_SOURCE_REQUIRED`);
      if (!nonEmpty(item?.retrievedAt)) errors.push(`EVIDENCE_${index}_TIMESTAMP_REQUIRED`);
      if (!nonEmpty(item?.kind)) errors.push(`EVIDENCE_${index}_KIND_REQUIRED`);
    }
  }

  if (errors.length) return { status: "REJECTED", errors };

  const transactionCostNzd = Number(candidate.transactionCostNzd ?? 0);
  const fulfilmentCostNzd = Number(candidate.fulfilmentCostNzd ?? 0);
  const taxReserveNzd = Number(candidate.taxReserveNzd ?? 0);
  const costs = [transactionCostNzd, fulfilmentCostNzd, taxReserveNzd];
  if (costs.some((v) => !Number.isFinite(v) || v < 0)) {
    return { status: "REJECTED", errors: ["COST_COMPONENTS_MUST_BE_NON_NEGATIVE"] };
  }

  const costFloorNzd = Number(candidate.unitCostNzd) + transactionCostNzd +
    fulfilmentCostNzd + taxReserveNzd;
  const priceNzd = Math.ceil(costFloorNzd / (1 - Number(candidate.targetMarginPct) / 100) * 100) / 100;
  const marginPct = priceNzd > 0 ? ((priceNzd - costFloorNzd) / priceNzd) * 100 : 0;

  return {
    status: "PROPOSED_NOT_PUBLISHED",
    sku: candidate.sku.trim(),
    siloId: candidate.siloId.trim(),
    currency: "NZD",
    priceNzd,
    costFloorNzd: Number(costFloorNzd.toFixed(2)),
    estimatedMarginPct: Number(marginPct.toFixed(2)),
    evidence: candidate.evidence.map(({ source, retrievedAt, kind }) => ({ source, retrievedAt, kind })),
    requiresGauntlet: true,
    requiresHumanApproval: true,
    mayAutoPublish: false,
  };
}

/**
 * Independent gate. This checks evidence shape and economics, not whether a
 * URL is trustworthy or whether external demand exists. Those require adapters.
 */
export function judgeWithGauntlet(proposal, checks = {}) {
  const failures = [];
  if (!proposal || proposal.status !== "PROPOSED_NOT_PUBLISHED") failures.push("VALID_PRICE_PROPOSAL_REQUIRED");
  if (!Array.isArray(proposal?.evidence) || proposal.evidence.length === 0) failures.push("EVIDENCE_REQUIRED");
  if (!finitePositive(proposal?.priceNzd)) failures.push("POSITIVE_PRICE_REQUIRED");
  if (!finitePositive(proposal?.costFloorNzd)) failures.push("POSITIVE_COST_FLOOR_REQUIRED");
  if (Number(proposal?.priceNzd) < Number(proposal?.costFloorNzd)) failures.push("PRICE_BELOW_COST_FLOOR");
  if (checks.sellerVerified !== true) failures.push("SELLER_VERIFICATION_MISSING");
  if (checks.siloBoundaryPassed !== true) failures.push("SILO_BOUNDARY_NOT_PROVEN");
  if (checks.policyPassed !== true) failures.push("POLICY_REVIEW_NOT_PASSED");
  if (checks.checkoutVerified !== true) failures.push("CHECKOUT_NOT_VERIFIED");
  if (checks.fulfillmentVerified !== true) failures.push("FULFILLMENT_NOT_VERIFIED");

  return {
    verdict: failures.length ? "REJECT" : "PASS_TO_HUMAN_REVIEW",
    failures,
    mayPublish: false,
    mayClaimRevenue: false,
  };
}

/**
 * Shared B2B/A2A transaction state machine. An agent is not a privileged seller
 * merely because it is an agent. Verified settlement and delivery evidence are
 * explicit, independently supplied facts.
 */
export function transitionTrade(trade, event) {
  if (!trade || !event) return { ok: false, error: "TRADE_AND_EVENT_REQUIRED" };
  const from = trade.state;
  const reject = (error) => ({ ok: false, error, trade });

  if (event.type === "ACCEPT_OFFER" && from === TRADE_STATES.INTENT) {
    if (event.sellerId === trade.buyerId) return reject("SELF_TRADE_BLOCKED");
    if (!nonEmpty(event.sellerId) || !nonEmpty(event.offerId)) return reject("SELLER_AND_OFFER_REQUIRED");
    return { ok: true, trade: { ...trade, sellerId: event.sellerId, offerId: event.offerId, state: TRADE_STATES.OFFER_ACCEPTED } };
  }
  if (event.type === "CREATE_CHECKOUT" && from === TRADE_STATES.OFFER_ACCEPTED) {
    if (event.checkoutVerified !== true || !nonEmpty(event.checkoutReference)) return reject("VERIFIED_CHECKOUT_REFERENCE_REQUIRED");
    return { ok: true, trade: { ...trade, checkoutReference: event.checkoutReference, state: TRADE_STATES.PAYMENT_PENDING } };
  }
  if (event.type === "VERIFY_SETTLEMENT" && from === TRADE_STATES.PAYMENT_PENDING) {
    if (event.providerVerified !== true || event.settled !== true || !nonEmpty(event.paymentReference) || !nonEmpty(event.webhookEventId)) {
      return reject("INDEPENDENT_SETTLEMENT_EVIDENCE_REQUIRED");
    }
    return { ok: true, trade: { ...trade, paymentReference: event.paymentReference, settlementEventId: event.webhookEventId, state: TRADE_STATES.PAID_VERIFIED } };
  }
  if (event.type === "BEGIN_FULFILLMENT" && from === TRADE_STATES.PAID_VERIFIED) {
    return { ok: true, trade: { ...trade, state: TRADE_STATES.FULFILLMENT_PENDING } };
  }
  if (event.type === "VERIFY_DELIVERY" && from === TRADE_STATES.FULFILLMENT_PENDING) {
    if (event.delivered !== true || !nonEmpty(event.deliveryReceiptId) || !nonEmpty(event.recipientId)) {
      return reject("RETRIEVABLE_DELIVERY_RECEIPT_REQUIRED");
    }
    return { ok: true, trade: { ...trade, deliveryReceiptId: event.deliveryReceiptId, deliveredTo: event.recipientId, state: TRADE_STATES.DELIVERED } };
  }
  if (event.type === "RAISE_DISPUTE" && [TRADE_STATES.PAID_VERIFIED, TRADE_STATES.FULFILLMENT_PENDING, TRADE_STATES.DELIVERED].includes(from)) {
    return { ok: true, trade: { ...trade, disputeReason: String(event.reason ?? "unspecified"), state: TRADE_STATES.DISPUTED } };
  }
  if (event.type === "CANCEL" && [TRADE_STATES.INTENT, TRADE_STATES.OFFER_ACCEPTED, TRADE_STATES.PAYMENT_PENDING].includes(from)) {
    return { ok: true, trade: { ...trade, state: TRADE_STATES.CANCELLED } };
  }
  return reject(`INVALID_TRANSITION:${from}:${event.type}`);
}

export function publicProductProjection(product) {
  if (!product || product.state !== PRODUCT_STATES.PUBLISHED) return null;
  if (!nonEmpty(product.sku) || !nonEmpty(product.title) || !finitePositive(product.priceNzd)) return null;
  if (product.gauntletVerdict !== "PASS" || product.humanApproved !== true) return null;
  return {
    sku: product.sku,
    title: product.title,
    priceNzd: product.priceNzd,
    currency: "NZD",
    sellerId: product.sellerId,
    siloId: product.siloId,
    availability: product.availability ?? "unknown",
    evidenceStatus: "UNVERIFIED_UNTIL_ORDER_RECONCILIATION",
  };
}
