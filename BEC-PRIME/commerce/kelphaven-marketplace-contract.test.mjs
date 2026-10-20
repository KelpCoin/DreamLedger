import test from "node:test";
import assert from "node:assert/strict";
import {
  proposePrice,
  judgeWithGauntlet,
  transitionTrade,
  publicProductProjection,
  PRODUCT_STATES,
  TRADE_STATES,
} from "./kelphaven-marketplace-contract.mjs";

const validCandidate = {
  sku: "DEMO-001",
  siloId: "mtg",
  currency: "NZD",
  unitCostNzd: 10,
  transactionCostNzd: 1,
  fulfilmentCostNzd: 2,
  taxReserveNzd: 0,
  targetMarginPct: 30,
  evidence: [{ source: "seller-cost-record:demo-1", retrievedAt: "2026-10-20T00:00:00Z", kind: "cost" }],
};

test("pricing proposes a reproducible NZD amount but never publishes", () => {
  const proposal = proposePrice(validCandidate);
  assert.equal(proposal.status, "PROPOSED_NOT_PUBLISHED");
  assert.equal(proposal.currency, "NZD");
  assert.ok(proposal.priceNzd >= proposal.costFloorNzd);
  assert.equal(proposal.mayAutoPublish, false);
});

test("pricing rejects missing evidence and fabricated costless candidates", () => {
  assert.equal(proposePrice({ ...validCandidate, evidence: [] }).status, "REJECTED");
  assert.equal(proposePrice({ ...validCandidate, unitCostNzd: 0 }).status, "REJECTED");
});

test("Gauntlet blocks without independent seller, silo, checkout and delivery checks", () => {
  const proposal = proposePrice(validCandidate);
  const verdict = judgeWithGauntlet(proposal);
  assert.equal(verdict.verdict, "REJECT");
  assert.equal(verdict.mayPublish, false);
  assert.equal(verdict.mayClaimRevenue, false);
});

test("Gauntlet can only pass a proposal to human review, never publish", () => {
  const proposal = proposePrice(validCandidate);
  const verdict = judgeWithGauntlet(proposal, {
    sellerVerified: true,
    siloBoundaryPassed: true,
    policyPassed: true,
    checkoutVerified: true,
    fulfillmentVerified: true,
  });
  assert.equal(verdict.verdict, "PASS_TO_HUMAN_REVIEW");
  assert.equal(verdict.mayPublish, false);
});

test("A2A and B2B trades require verified checkout, settlement and delivery receipts", () => {
  let result = transitionTrade({ id: "t1", buyerId: "buyer-a", state: TRADE_STATES.INTENT }, {
    type: "ACCEPT_OFFER", sellerId: "seller-b", offerId: "offer-1",
  });
  assert.equal(result.ok, true);
  result = transitionTrade(result.trade, { type: "CREATE_CHECKOUT", checkoutVerified: false });
  assert.equal(result.ok, false);

  result = transitionTrade(result.trade, { type: "CREATE_CHECKOUT", checkoutVerified: true, checkoutReference: "checkout-1" });
  assert.equal(result.trade.state, TRADE_STATES.PAYMENT_PENDING);
  const blockedSettlement = transitionTrade(result.trade, {
    type: "VERIFY_SETTLEMENT", providerVerified: false, settled: true,
    paymentReference: "pay-1", webhookEventId: "evt-1",
  });
  assert.equal(blockedSettlement.ok, false);

  result = transitionTrade(result.trade, {
    type: "VERIFY_SETTLEMENT", providerVerified: true, settled: true,
    paymentReference: "pay-1", webhookEventId: "evt-1",
  });
  assert.equal(result.trade.state, TRADE_STATES.PAID_VERIFIED);
  result = transitionTrade(result.trade, { type: "BEGIN_FULFILLMENT" });
  assert.equal(result.trade.state, TRADE_STATES.FULFILLMENT_PENDING);
  const noReceipt = transitionTrade(result.trade, { type: "VERIFY_DELIVERY", delivered: true });
  assert.equal(noReceipt.ok, false);
  result = transitionTrade(result.trade, {
    type: "VERIFY_DELIVERY", delivered: true, deliveryReceiptId: "receipt-1", recipientId: "buyer-a",
  });
  assert.equal(result.trade.state, TRADE_STATES.DELIVERED);
});

test("self-trading is blocked", () => {
  const result = transitionTrade({ id: "t2", buyerId: "same", state: TRADE_STATES.INTENT }, {
    type: "ACCEPT_OFFER", sellerId: "same", offerId: "offer-2",
  });
  assert.equal(result.ok, false);
  assert.equal(result.error, "SELF_TRADE_BLOCKED");
});

test("unapproved, unpriced, or unverified products never enter public catalogue projection", () => {
  const product = {
    sku: "DEMO-001", title: "Demo", priceNzd: 10, sellerId: "seller",
    siloId: "mtg", state: PRODUCT_STATES.READY_FOR_HUMAN_APPROVAL,
    gauntletVerdict: "PASS", humanApproved: true,
  };
  assert.equal(publicProductProjection(product), null);
  assert.equal(publicProductProjection({ ...product, state: PRODUCT_STATES.PUBLISHED }), null);
  assert.ok(publicProductProjection({
    ...product, state: PRODUCT_STATES.PUBLISHED, priceNzd: 10,
  }) === null); // explicit evidence verdict is still required
  assert.deepEqual(publicProductProjection({
    ...product, state: PRODUCT_STATES.PUBLISHED, priceNzd: 10,
    gauntletVerdict: "PASS", humanApproved: true,
  }), {
    sku: "DEMO-001", title: "Demo", priceNzd: 10, currency: "NZD",
    sellerId: "seller", siloId: "mtg", availability: "unknown",
    evidenceStatus: "UNVERIFIED_UNTIL_ORDER_RECONCILIATION",
  });
});
