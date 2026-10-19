'use strict';

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function text(value) {
  return value == null ? '' : String(value).trim();
}

function number(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function buildRevenueLaneReadiness(input = {}) {
  const approvedOffers = Array.isArray(input.approvedOffers) ? input.approvedOffers : [];
  const liveOffers = Array.isArray(input.liveOffers) ? input.liveOffers : [];
  const publicProducts = Array.isArray(input.publicProducts) ? input.publicProducts : [];
  const recurringPlans = Array.isArray(input.recurringPlans) ? input.recurringPlans : [];
  const evergreenAdapters = Array.isArray(input.evergreenAdapters) ? input.evergreenAdapters : [];
  const fulfillmentEntries = input.fulfillmentEntries && typeof input.fulfillmentEntries === 'object'
    ? input.fulfillmentEntries
    : {};

  function findPublicProduct(offer) {
    const ids = [offer.product_id, offer.product_sku, offer.productSku].map(text).filter(Boolean);
    return publicProducts.find(product =>
      ids.includes(text(product.id)) || ids.includes(text(product.sku))
    ) || null;
  }

  function findFulfillment(offer, product) {
    const keys = [
      offer.product_id,
      offer.product_sku,
      product && product.id,
      product && product.sku
    ].map(text).filter(Boolean);
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(fulfillmentEntries, key)) {
        return { key, entry: fulfillmentEntries[key] };
      }
    }
    return { key: null, entry: null };
  }

  const approvedOfferIds = new Set(approvedOffers.map(x => text(x.offer_id)).filter(Boolean));

  const approvedOfferLanes = approvedOffers.map(offer => {
    const reasons = [];
    const offerId = text(offer.offer_id);
    const liveMatches = liveOffers.filter(item => text(item.offer_id) === offerId);
    const live = liveMatches[0] || null;
    const product = findPublicProduct(offer);
    const fulfillment = findFulfillment(offer, product);
    const expectedUrl = text(offer.payment_link_url);
    const expectedPrice = number(offer.price);

    if (!offerId) reasons.push('APPROVED_OFFER_ID_MISSING');
    if (!expectedUrl) reasons.push('APPROVED_CHECKOUT_URL_MISSING');
    if (expectedPrice == null || expectedPrice <= 0) reasons.push('APPROVED_PRICE_INVALID');
    if (!text(offer.fulfillment_route)) reasons.push('FULFILLMENT_ROUTE_MISSING');
    if (!text(offer.proof_of_delivery)) reasons.push('DELIVERY_PROOF_CONTRACT_MISSING');

    if (!live) {
      reasons.push('LIVE_COMMERCE_RECORD_MISSING');
    } else {
      const liveUrl = text(live.checkout);
      if (!liveUrl) reasons.push('LIVE_COMMERCE_CHECKOUT_URL_MISSING');
      else if (liveUrl !== expectedUrl) reasons.push('APPROVED_VS_LIVE_CHECKOUT_URL_MISMATCH');
      if (number(live.price_nzd) !== expectedPrice) reasons.push('APPROVED_VS_LIVE_PRICE_MISMATCH');
      if (text(live.silo) && text(offer.silo) && text(live.silo).toLowerCase() !== text(offer.silo).toLowerCase()) {
        reasons.push('APPROVED_VS_LIVE_SILO_MISMATCH');
      }
      if (text(live.status) !== 'ACTIVE_LIVEMODE') reasons.push('LIVE_COMMERCE_STATUS_NOT_ACTIVE_LABEL');
    }

    if (!product) {
      reasons.push('PUBLIC_PRODUCT_RECORD_MISSING');
    } else {
      if (text(product.status).toLowerCase() !== 'published') reasons.push('PUBLIC_PRODUCT_NOT_PUBLISHED');
      if (product.checkout_available === false) reasons.push('PUBLIC_CHECKOUT_NOT_AVAILABLE');
      if (!text(product.checkout_url)) reasons.push('PUBLIC_CHECKOUT_URL_MISSING');
      else if (text(product.checkout_url) !== expectedUrl) reasons.push('APPROVED_VS_PUBLIC_CHECKOUT_URL_MISMATCH');
      if (number(product.price_nzd ?? product.price) !== expectedPrice) reasons.push('APPROVED_VS_PUBLIC_PRICE_MISMATCH');
      if (text(product.currency) && text(offer.currency) &&
        text(product.currency).toUpperCase() !== text(offer.currency).toUpperCase()) {
        reasons.push('APPROVED_VS_PUBLIC_CURRENCY_MISMATCH');
      }
      if (text(product.silo) && text(offer.silo) && text(product.silo).toLowerCase() !== text(offer.silo).toLowerCase()) {
        reasons.push('APPROVED_VS_PUBLIC_SILO_MISMATCH');
      }
    }

    if (!fulfillment.entry) {
      reasons.push('FULFILLMENT_REGISTRY_ENTRY_MISSING');
    } else {
      if (fulfillment.entry.ready !== true) reasons.push('FULFILLMENT_REGISTRY_NOT_READY');
      if (fulfillment.entry.operator_required === true && offer.automated_fulfillment_required === true) {
        reasons.push('FULFILLMENT_REQUIRES_OPERATOR');
      }
    }

    const blockerCodes = unique(reasons);
    const configurationStatus = blockerCodes.length
      ? 'BLOCKED_CONFIGURATION_CONFLICT'
      : 'CONFIGURATION_COHERENT_PROVIDER_CHECK_REQUIRED';

    return {
      lane_id: offerId || null,
      offer_id: offerId || null,
      product_id: text(offer.product_id) || null,
      silo: text(offer.silo) || null,
      price_nzd: expectedPrice,
      checkout_url: expectedUrl || null,
      public_product_status: product ? text(product.status) || null : null,
      live_catalog_checkout_url: live ? text(live.checkout) || null : null,
      fulfillment_registry_key: fulfillment.key,
      configuration_status: configurationStatus,
      live_provider_state: 'NOT_VERIFIED_BY_LOCAL_COMPILER',
      settlement_state: 'UNVERIFIED',
      verified_revenue_nzd: 0,
      external_action: 'BLOCKED_UNTIL_SEPARATE_PROVIDER_CHECK_AND_HUMAN_APPROVAL',
      blocker_codes: blockerCodes,
      next_action: blockerCodes.length
        ? 'RECONCILE_CANONICAL_OFFER_CHECKOUT_PUBLIC_SURFACE_AND_FULFILLMENT'
        : 'PERFORM_READ_ONLY_LIVE_PROVIDER_CHECK_THEN_CONTROLLED_VALIDATION'
    };
  });

  const unmatchedLiveOffers = liveOffers
    .filter(live => !approvedOfferIds.has(text(live.offer_id)))
    .map(live => ({
      offer_id: text(live.offer_id) || null,
      checkout_url: text(live.checkout) || null,
      price_nzd: number(live.price_nzd),
      silo: text(live.silo) || null,
      configuration_status: 'BLOCKED_NO_APPROVED_OFFER',
      blocker_codes: ['NO_APPROVED_OFFER_RECORD'],
      external_action: 'BLOCKED'
    }));

  const approvedProductIds = new Set();
  for (const offer of approvedOffers) {
    for (const key of [offer.product_id, offer.product_sku]) {
      if (text(key)) approvedProductIds.add(text(key));
    }
  }

  const publicCatalogOnlyProducts = publicProducts
    .filter(product =>
      text(product.status).toLowerCase() === 'published' &&
      text(product.checkout_url) &&
      !approvedProductIds.has(text(product.id)) &&
      !approvedProductIds.has(text(product.sku))
    )
    .map(product => {
      const registry = fulfillmentEntries[text(product.id)] || fulfillmentEntries[text(product.sku)] || null;
      const blockers = ['NO_APPROVED_OFFER_RECORD'];
      if (!registry) blockers.push('FULFILLMENT_REGISTRY_ENTRY_MISSING');
      else if (registry.ready !== true) blockers.push('FULFILLMENT_REGISTRY_NOT_READY');
      return {
        product_id: text(product.id) || null,
        sku: text(product.sku) || null,
        name: text(product.name) || null,
        price_nzd: number(product.price_nzd),
        checkout_url: text(product.checkout_url),
        configuration_status: 'BLOCKED_UNAPPROVED_PUBLIC_PRODUCT',
        blocker_codes: unique(blockers),
        external_action: 'BLOCKED'
      };
    });

  const recurringLanes = recurringPlans
    .filter(plan => number(plan.price_nzd_month) > 0 && text(plan.stripe_price_id))
    .map(plan => ({
      lane_id: 'TRUTH-ORACLE-SUBSCRIPTION:' + (text(plan.tier) || 'UNKNOWN'),
      offer_id: null,
      tier: text(plan.tier) || null,
      name: text(plan.display_name || plan.tier) || null,
      price_nzd_month: number(plan.price_nzd_month),
      stripe_price_id: text(plan.stripe_price_id),
      configuration_status: 'RECURRING_ROUTE_CONFIGURED_REQUIRES_PROVIDER_AND_ENTITLEMENT_TEST',
      blocker_codes: [
        'NO_APPROVED_RECURRING_OFFER_MAPPING',
        'NO_INDEPENDENT_SUBSCRIPTION_PROOF_IN_LOCAL_EVIDENCE'
      ],
      verified_revenue_nzd: 0,
      external_action: 'BLOCKED'
    }));

  const quoteAdapters = evergreenAdapters.filter(adapter =>
    text(adapter.fulfillment).toUpperCase() === 'SUPPLIER_QUOTE_COMPARISON' ||
    /quote/i.test(text(adapter.slug))
  );
  const quoteUrlCounts = new Map();
  for (const adapter of quoteAdapters) {
    const url = text(adapter.checkout_url);
    if (url) quoteUrlCounts.set(url, (quoteUrlCounts.get(url) || 0) + 1);
  }
  const quoteReasons = [];
  if (!approvedOffers.some(offer =>
    ['QUOTE-COMPARE-49', 'OFFER-QUOTE-COMPARE-49'].includes(text(offer.offer_id)) ||
    ['QUOTE-COMPARE-49', 'CONSTRUCTION-QUOTE-COMPARE-49'].includes(text(offer.product_sku))
  )) quoteReasons.push('NO_APPROVED_QUOTE_COMPARISON_OFFER');
  if ([...quoteUrlCounts.values()].some(count => count > 1)) quoteReasons.push('SHARED_CHECKOUT_URL_ACROSS_ADAPTERS');
  const quoteAdapterFamily = {
    family_id: 'QUOTE-COMPARE-49',
    adapter_count: quoteAdapters.length,
    distinct_configured_checkout_urls: quoteUrlCounts.size,
    shared_checkout_adapter_count: [...quoteUrlCounts.values()].filter(count => count > 1).reduce((sum, count) => sum + count, 0),
    configuration_status: quoteReasons.length
      ? 'BLOCKED_SHARED_CHECKOUT_OR_APPROVAL_MAPPING'
      : 'CONFIGURATION_COHERENT_PROVIDER_CHECK_REQUIRED',
    blocker_codes: unique(quoteReasons),
    external_action: 'BLOCKED'
  };

  const commander = approvedOfferLanes.find(lane => lane.offer_id === 'OFFER-CMD-DIAG-29-NZD') || null;
  const recommendedNext = commander
    ? {
        lane_id: commander.lane_id,
        offer_id: commander.offer_id,
        silo: 'mtg',
        target_price_nzd: 29,
        priority: 'P1_REPAIR_EXISTING_FIRST_SALE_PATH',
        current_configuration_status: commander.configuration_status,
        blocker_codes: commander.blocker_codes,
        action: 'RECONCILE_COMMANDER_OFFER_TO_ONE_CANONICAL_CHECKOUT_AND_RESTORE_SETTLEMENT_LEDGER_ACCESS',
        external_action: 'NONE',
        revenue_claim_nzd: 0
      }
    : {
        lane_id: null,
        priority: 'P1_FIND_EXISTING_APPROVED_OFFER',
        action: 'RECONCILE_EXISTING_APPROVED_OFFERS_BEFORE_OPENING_NEW_LANES',
        external_action: 'NONE',
        revenue_claim_nzd: 0
      };

  const coherentCount = approvedOfferLanes.filter(lane =>
    lane.configuration_status === 'CONFIGURATION_COHERENT_PROVIDER_CHECK_REQUIRED'
  ).length;

  return {
    schema: 'DREAMLEDGER/777/REVENUE-LANE-READINESS/v1',
    objective: 'Find and repair the nearest existing revenue paths without inventing buyers, payments, or completed delivery.',
    local_configuration_only: true,
    verified_revenue_nzd: 0,
    revenue_claims_permitted: false,
    approved_offer_lane_count: approvedOfferLanes.length,
    configuration_coherent_lane_count: coherentCount,
    blocked_approved_lane_count: approvedOfferLanes.length - coherentCount,
    approved_offer_lanes: approvedOfferLanes,
    unmatched_live_offers: unmatchedLiveOffers,
    unapproved_public_checkout_products: publicCatalogOnlyProducts,
    recurring_lanes: recurringLanes,
    quote_adapter_family: quoteAdapterFamily,
    recommended_next: recommendedNext,
    rules: [
      'A configured price or checkout URL is not settlement evidence.',
      'A local catalogue label is not live-provider verification.',
      'A revenue lane cannot be promoted without correct offer identity, price, silo, public surface, fulfillment contract, and delivery proof.',
      'No public outreach, checkout activation, charge, or production mutation is performed by this audit.'
    ]
  };
}

module.exports = { buildRevenueLaneReadiness };
