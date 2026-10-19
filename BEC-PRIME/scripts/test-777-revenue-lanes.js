'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { buildRevenueLaneReadiness } = require('../economic/RevenueLaneReadiness');

function fixture(overrides = {}) {
  return {
    approvedOffers: [{
      offer_id: 'OFFER-CMD-DIAG-29-NZD',
      product_id: 'COMMANDER-DECK-DIAGNOSTIC-001',
      product_sku: 'CMD-DIAG-29',
      silo: 'mtg',
      name: 'Commander Deck Diagnostic',
      price: 29,
      currency: 'NZD',
      payment_link_url: 'https://buy.stripe.com/canonical',
      fulfillment_route: '/mtg/diagnostic',
      proof_of_delivery: 'settled payment + report artifact + ledger event'
    }],
    liveOffers: [{
      offer_id: 'OFFER-CMD-DIAG-29-NZD',
      price_nzd: 29,
      checkout: 'https://buy.stripe.com/canonical',
      status: 'ACTIVE_LIVEMODE',
      silo: 'mtg'
    }],
    publicProducts: [{
      id: 'COMMANDER-DECK-DIAGNOSTIC-001',
      sku: 'CMD-DIAG-29',
      name: 'Commander Deck Diagnostic',
      price: 29,
      currency: 'nzd',
      status: 'published',
      checkout_available: true,
      checkout_url: 'https://buy.stripe.com/canonical',
      silo: 'mtg'
    }],
    fulfillmentEntries: {
      'COMMANDER-DECK-DIAGNOSTIC-001': {
        ready: true,
        operator_required: false
      }
    },
    recurringPlans: [],
    evergreenAdapters: [],
    ...overrides
  };
}

test('fully aligned repository configuration is a provider-check candidate, not revenue', () => {
  const report = buildRevenueLaneReadiness(fixture());
  assert.equal(report.approved_offer_lanes.length, 1);
  assert.equal(report.approved_offer_lanes[0].configuration_status, 'CONFIGURATION_COHERENT_PROVIDER_CHECK_REQUIRED');
  assert.equal(report.approved_offer_lanes[0].live_provider_state, 'NOT_VERIFIED_BY_LOCAL_COMPILER');
  assert.equal(report.verified_revenue_nzd, 0);
  assert.equal(report.revenue_claims_permitted, false);
  assert.equal(report.approved_offer_lanes[0].external_action, 'BLOCKED_UNTIL_SEPARATE_PROVIDER_CHECK_AND_HUMAN_APPROVAL');
});

test('checkout URL conflicts across approved, live and public catalogues block the lane', () => {
  const input = fixture({
    liveOffers: [{
      offer_id: 'OFFER-CMD-DIAG-29-NZD',
      price_nzd: 29,
      checkout: 'https://buy.stripe.com/different-live-link',
      status: 'ACTIVE_LIVEMODE',
      silo: 'mtg'
    }],
    publicProducts: [{
      id: 'COMMANDER-DECK-DIAGNOSTIC-001',
      sku: 'CMD-DIAG-29',
      name: 'Commander Deck Diagnostic',
      price: 29,
      currency: 'nzd',
      status: 'held',
      checkout_available: false,
      checkout_url: null,
      silo: 'mtg'
    }]
  });
  const lane = buildRevenueLaneReadiness(input).approved_offer_lanes[0];
  assert.equal(lane.configuration_status, 'BLOCKED_CONFIGURATION_CONFLICT');
  assert.ok(lane.blocker_codes.includes('APPROVED_VS_LIVE_CHECKOUT_URL_MISMATCH'));
  assert.ok(lane.blocker_codes.includes('PUBLIC_PRODUCT_NOT_PUBLISHED'));
  assert.ok(lane.blocker_codes.includes('PUBLIC_CHECKOUT_NOT_AVAILABLE'));
  assert.ok(lane.blocker_codes.includes('PUBLIC_CHECKOUT_URL_MISSING'));
  assert.equal(lane.verified_revenue_nzd, 0);
});

test('published product with checkout but no approved offer is quarantined from 777 activation', () => {
  const input = fixture({
    approvedOffers: [],
    liveOffers: [],
    publicProducts: [{
      id: 'DISCORD-WEBHOOK-STARTER-KIT-001',
      sku: 'DISCORD_WEBHOOK_STARTER_KIT',
      name: 'Discord Webhook Starter Kit',
      price_nzd: 79,
      status: 'published',
      checkout_url: 'https://buy.stripe.com/discord'
    }],
    fulfillmentEntries: {}
  });
  const report = buildRevenueLaneReadiness(input);
  assert.equal(report.unapproved_public_checkout_products.length, 1);
  assert.ok(report.unapproved_public_checkout_products[0].blocker_codes.includes('NO_APPROVED_OFFER_RECORD'));
  assert.ok(report.unapproved_public_checkout_products[0].blocker_codes.includes('FULFILLMENT_REGISTRY_ENTRY_MISSING'));
});

test('shared supplier-quote checkout is blocked from being treated as ten distinct lanes', () => {
  const input = fixture({
    approvedOffers: [],
    liveOffers: [],
    publicProducts: [],
    fulfillmentEntries: {},
    evergreenAdapters: Array.from({ length: 10 }, (_, i) => ({
      slug: 'supplier-' + i,
      fulfillment: 'SUPPLIER_QUOTE_COMPARISON',
      checkout_url: 'https://buy.stripe.com/shared'
    }))
  });
  const report = buildRevenueLaneReadiness(input);
  assert.equal(report.quote_adapter_family.adapter_count, 10);
  assert.equal(report.quote_adapter_family.distinct_configured_checkout_urls, 1);
  assert.ok(report.quote_adapter_family.blocker_codes.includes('NO_APPROVED_QUOTE_COMPARISON_OFFER'));
  assert.ok(report.quote_adapter_family.blocker_codes.includes('SHARED_CHECKOUT_URL_ACROSS_ADAPTERS'));
});

test('diversified portfolio reports five distinct revenue models without promoting any to revenue', () => {
  const report = buildRevenueLaneReadiness(fixture({
    recurringPlans: [
      { tier: 'SIGNAL', display_name: 'Observer', price_nzd_month: 4.99, stripe_price_id: 'price_signal' },
      { tier: 'INTELLIGENCE', display_name: 'Investigator', price_nzd_month: 7.99, stripe_price_id: 'price_intelligence' },
      { tier: 'DEEP_EVIDENCE', display_name: 'Deep Evidence', price_nzd_month: 9.99, stripe_price_id: 'price_deep' }
    ],
    publicProducts: [
      { id: 'COMMANDER-DECK-DIAGNOSTIC-001', sku: 'CMD-DIAG-29', price: 29, currency: 'nzd', status: 'held', checkout_available: false, checkout_url: null },
      { id: 'DISCORD-WEBHOOK-STARTER-KIT-001', sku: 'DISCORD_WEBHOOK_STARTER_KIT', price: 79, currency: 'nzd', status: 'published', checkout_available: true, checkout_url: 'https://buy.stripe.com/discord', delivery_test_status: 'UNVERIFIED' },
      { id: 'SELLER-PROFIT-AUDIT-001', sku: 'SELLER-PROFIT-AUDIT-001', price: 29, currency: 'nzd', status: 'published', checkout_available: true, checkout_url: 'https://buy.stripe.com/seller' }
    ],
    fulfillmentEntries: { 'COMMANDER-DECK-DIAGNOSTIC-001': { ready: true, operator_required: false } },
    buyerSignalRecords: [{ offer_id: 'OFFER-CMD-DIAG-29-NZD' }, { offer_id: 'OFFER-CMD-DIAG-29-NZD' }],
    defaultBuyerSignalOfferId: 'OFFER-CMD-DIAG-29-NZD',
    discordArtifactPresent: true,
    evergreenAdapters: Array.from({ length: 10 }, (_, i) => ({ slug: 'supplier-' + i, fulfillment: 'SUPPLIER_QUOTE_COMPARISON', checkout_url: 'https://buy.stripe.com/shared' }))
  }));
  assert.equal(report.diversified_stream_candidates.length, 5);
  assert.deepEqual(report.diversified_stream_candidates.map(x => x.revenue_model), [
    'ONE_TIME_DIGITAL_SERVICE',
    'ONE_TIME_DIGITAL_DOWNLOAD',
    'ONE_TIME_QUOTE_COMPARISON',
    'RECURRING_SUBSCRIPTION',
    'ONE_TIME_REPORT_SERVICE'
  ]);
  assert.equal(report.diversified_stream_candidates[0].existing_buyer_problem_records, 2);
  assert.ok(report.diversified_stream_candidates.every(x => x.revenue_claim_permitted === false && x.verified_revenue_nzd === 0));
  assert.ok(report.diversified_stream_candidates[1].blocker_codes.includes('NO_APPROVED_OFFER_RECORD'));
  assert.ok(report.diversified_stream_candidates[2].blocker_codes.includes('SHARED_CHECKOUT_URL_ACROSS_ADAPTERS'));
  assert.ok(report.diversified_stream_candidates[3].blocker_codes.includes('NO_INDEPENDENT_SUBSCRIPTION_PROOF_IN_LOCAL_EVIDENCE'));
});

test('recurring plan configuration is not treated as an active subscriber or revenue', () => {
  const report = buildRevenueLaneReadiness(fixture({
    recurringPlans: [{
      tier: 'SIGNAL',
      display_name: 'Observer',
      price_nzd_month: 4.99,
      stripe_price_id: 'price_test'
    }]
  }));
  assert.equal(report.recurring_lanes.length, 1);
  assert.ok(report.recurring_lanes[0].blocker_codes.includes('NO_INDEPENDENT_SUBSCRIPTION_PROOF_IN_LOCAL_EVIDENCE'));
  assert.equal(report.recurring_lanes[0].verified_revenue_nzd, 0);
});


test('public product price uses the canonical price field when price_nzd is absent', () => {
  const report = buildRevenueLaneReadiness(fixture({
    publicProducts: [{
      id: 'COMMANDER-DECK-DIAGNOSTIC-001',
      sku: 'CMD-DIAG-29',
      price: 29,
      currency: 'NZD',
      status: 'published',
      checkout_available: true,
      checkout_url: 'https://buy.stripe.com/canonical',
      silo: 'mtg'
    }]
  }));
  assert.equal(report.approved_offer_lanes[0].configuration_status, 'CONFIGURATION_COHERENT_PROVIDER_CHECK_REQUIRED');
  assert.ok(!report.approved_offer_lanes[0].blocker_codes.includes('APPROVED_VS_PUBLIC_PRICE_MISMATCH'));
});

test('fulfillment registry can resolve the canonical offer ID', () => {
  const report = buildRevenueLaneReadiness(fixture({
    fulfillmentEntries: {
      'OFFER-CMD-DIAG-29-NZD': { ready: true, operator_required: false }
    }
  }));
  const lane = report.approved_offer_lanes[0];
  assert.equal(lane.fulfillment_registry_key, 'OFFER-CMD-DIAG-29-NZD');
  assert.ok(!lane.blocker_codes.includes('FULFILLMENT_REGISTRY_ENTRY_MISSING'));
});

test('any operator-required fulfillment route remains blocked', () => {
  const report = buildRevenueLaneReadiness(fixture({
    fulfillmentEntries: {
      'COMMANDER-DECK-DIAGNOSTIC-001': { ready: true, operator_required: true }
    }
  }));
  assert.ok(report.approved_offer_lanes[0].blocker_codes.includes('FULFILLMENT_REQUIRES_OPERATOR'));
  assert.equal(report.approved_offer_lanes[0].configuration_status, 'BLOCKED_CONFIGURATION_CONFLICT');
});
