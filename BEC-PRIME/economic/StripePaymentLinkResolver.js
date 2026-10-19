'use strict';

function nzdToMinor(value) {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) : null;
}

function asText(value) {
  return value == null ? '' : String(value).trim();
}

function normalizeCurrency(value) {
  return asText(value).toLowerCase();
}

function firstText(...values) {
  for (const value of values) {
    const result = asText(value);
    if (result) return result;
  }
  return '';
}

function metadataIdentityMatches(link, offer) {
  const metadata = link && link.metadata && typeof link.metadata === 'object' ? link.metadata : {};
  const expectedOfferId = asText(offer && offer.offer_id).toLowerCase();
  const actualOfferId = asText(metadata.offer_id || metadata.dreamledger_offer_id).toLowerCase();
  const expectedProductId = asText(offer && offer.product_id).toLowerCase();
  const actualProductId = asText(metadata.product_id || metadata.dreamledger_product_id).toLowerCase();
  const expectedSku = asText(offer && (offer.product_sku || offer.sku || offer.sku_id)).toLowerCase();
  const actualSku = asText(metadata.product_sku || metadata.sku || metadata.sku_id || metadata.dreamledger_sku).toLowerCase();

  if (!expectedOfferId || !actualOfferId || actualOfferId !== expectedOfferId) return false;
  if (!expectedProductId || !actualProductId || actualProductId !== expectedProductId) return false;
  if (!expectedSku || !actualSku || actualSku !== expectedSku) return false;
  return true;
}

function inspectStripeLink(link, lineItems, expectedAmountMinor, expectedCurrency, apiMode, offer) {
  const blockers = [];
  if (!link) {
    blockers.push('STRIPE_PAYMENT_LINK_NOT_FOUND_BY_EXACT_URL');
    return {
      stripe_payment_link_id: null,
      url: null,
      active: false,
      api_mode: apiMode || 'UNKNOWN',
      amount_minor: null,
      currency: null,
      identity_metadata_match: false,
      blocker_codes: blockers
    };
  }

  if (link.active !== true) blockers.push('STRIPE_PAYMENT_LINK_INACTIVE');
  if (apiMode !== 'live') blockers.push('STRIPE_API_KEY_NOT_LIVE');
  const lines = Array.isArray(lineItems) ? lineItems : [];
  if (!lines.length) blockers.push('STRIPE_PAYMENT_LINK_HAS_NO_RESOLVABLE_LINE_ITEMS');

  let amountMinor = 0;
  let lineCurrency = '';
  let amountKnown = lines.length > 0;
  let currencyConflict = false;
  let recurring = false;

  for (const item of lines) {
    const price = item && item.price && typeof item.price === 'object' ? item.price : {};
    const unitAmount = Number(price.unit_amount ?? item.unit_amount);
    const quantity = Number(item.quantity ?? 1);
    const currency = normalizeCurrency(price.currency || item.currency);
    if (!Number.isFinite(unitAmount) || !Number.isFinite(quantity) || quantity < 1) {
      amountKnown = false;
    } else {
      amountMinor += unitAmount * quantity;
    }
    if (!currency) {
      amountKnown = false;
    } else if (!lineCurrency) {
      lineCurrency = currency;
    } else if (lineCurrency !== currency) {
      currencyConflict = true;
    }
    if (price.recurring || item.recurring) recurring = true;
  }

  if (!amountKnown) blockers.push('STRIPE_LINE_ITEM_AMOUNT_OR_CURRENCY_UNRESOLVED');
  if (currencyConflict) blockers.push('STRIPE_LINE_ITEM_CURRENCY_CONFLICT');
  if (recurring) blockers.push('UNEXPECTED_RECURRING_PRICE_ON_ONE_TIME_OFFER');
  if (expectedAmountMinor == null || expectedAmountMinor <= 0 || !amountKnown || amountMinor !== expectedAmountMinor) {
    blockers.push('STRIPE_AMOUNT_MINOR_MISMATCH');
  }
  if (expectedAmountMinor === 0) blockers.push('STRIPE_OFFER_AMOUNT_MUST_BE_POSITIVE');
  if (!lineCurrency || lineCurrency !== normalizeCurrency(expectedCurrency)) {
    blockers.push('STRIPE_CURRENCY_MISMATCH');
  }

  const identityMatch = metadataIdentityMatches(link, offer);
  if (!identityMatch) blockers.push('STRIPE_METADATA_DOES_NOT_IDENTIFY_APPROVED_OFFER');
  return {
    stripe_payment_link_id: link.id || null,
    url: link.url || null,
    active: link.active === true,
    api_mode: apiMode || 'UNKNOWN',
    amount_minor: amountKnown && !currencyConflict ? amountMinor : null,
    currency: currencyConflict ? null : (lineCurrency || null),
    identity_metadata_match: identityMatch,
    line_items: lines.map(item => ({
      price_id: typeof item.price === 'string' ? item.price : (item.price && item.price.id) || null,
      quantity: Number(item.quantity ?? 1),
      amount_minor_per_unit: Number(item.price?.unit_amount ?? item.unit_amount ?? NaN),
      currency: normalizeCurrency(item.price?.currency || item.currency) || null
    })),
    blocker_codes: [...new Set(blockers)]
  };
}

function buildOfferParityReceipt({ offer, liveOffer, publicProduct, stripeLinks, lineItemsByLinkId, apiMode, fulfillmentEntry, publicPage }) {
  const expectedAmountMinor = nzdToMinor(offer.price);
  const expectedCurrency = normalizeCurrency(offer.currency || 'NZD');
  const approvedUrl = asText(offer.payment_link_url) || null;
  const liveUrl = asText(liveOffer && liveOffer.checkout) || null;
  const publicUrl = asText(publicProduct && (publicProduct.checkout_url || publicProduct.payment_link_url)) || null;
  const allLinks = Array.isArray(stripeLinks) ? stripeLinks : [];
  const suppliedUrls = [...new Set([approvedUrl, liveUrl, publicUrl].filter(Boolean))];

  const providerByUrl = suppliedUrls.map(url => ({
    url,
    link: allLinks.find(link => asText(link.url) === url) || null
  }));

  const canonicalIdentityCandidates = allLinks
    .filter(link => metadataIdentityMatches(link, offer))
    .map(link => {
      const items = lineItemsByLinkId && lineItemsByLinkId[link.id] || [];
      return {
        link,
        inspection: inspectStripeLink(link, items, expectedAmountMinor, expectedCurrency, apiMode, offer)
      };
    });

  const amountMatchedIdentityCandidates = canonicalIdentityCandidates.filter(item =>
    item.inspection.active &&
    item.inspection.api_mode === 'live' &&
    item.inspection.amount_minor === expectedAmountMinor &&
    item.inspection.currency === expectedCurrency &&
    item.inspection.identity_metadata_match
  );

  const surfaceProviderChecks = providerByUrl.map(({ url, link }) => {
    const lines = link && lineItemsByLinkId ? lineItemsByLinkId[link.id] : [];
    return {
      configured_url: url,
      provider: inspectStripeLink(link, lines, expectedAmountMinor, expectedCurrency, apiMode, offer)
    };
  });

  const blockers = [];
  if (!approvedUrl) blockers.push('APPROVED_CATALOGUE_CHECKOUT_URL_MISSING');
  if (!liveUrl) blockers.push('LIVE_COMMERCE_CHECKOUT_URL_MISSING');
  if (!publicUrl) blockers.push('PUBLIC_CATALOGUE_CHECKOUT_URL_MISSING');
  if (new Set([approvedUrl, liveUrl, publicUrl].filter(Boolean)).size > 1) {
    blockers.push('CHECKOUT_URL_DIVERGENCE_ACROSS_CATALOGUES');
  }
  if (!publicProduct) blockers.push('PUBLIC_PRODUCT_RECORD_MISSING');
  else {
    if (asText(publicProduct.status).toLowerCase() !== 'published') blockers.push('PUBLIC_PRODUCT_NOT_PUBLISHED');
    if (publicProduct.checkout_available === false) blockers.push('PUBLIC_CHECKOUT_NOT_AVAILABLE');
    const publicAmount = nzdToMinor(publicProduct.price_nzd ?? publicProduct.price);
    if (publicAmount == null || publicAmount !== expectedAmountMinor) blockers.push('PUBLIC_COPY_PRICE_MISMATCH');
    const publicCurrency = normalizeCurrency(publicProduct.currency || expectedCurrency);
    if (publicCurrency !== expectedCurrency) blockers.push('PUBLIC_COPY_CURRENCY_MISMATCH');
  }
  if (liveOffer) {
    if (asText(liveOffer.status) !== 'ACTIVE_LIVEMODE') blockers.push('LIVE_COMMERCE_NOT_MARKED_ACTIVE_LIVEMODE');
    if (nzdToMinor(liveOffer.price_nzd) !== expectedAmountMinor) blockers.push('LIVE_COMMERCE_PRICE_MISMATCH');
    if (normalizeCurrency(liveOffer.silo) && normalizeCurrency(offer.silo) &&
        normalizeCurrency(liveOffer.silo) !== normalizeCurrency(offer.silo)) blockers.push('LIVE_COMMERCE_SILO_MISMATCH');
  } else {
    blockers.push('LIVE_COMMERCE_RECORD_MISSING');
  }

  for (const item of surfaceProviderChecks) {
    for (const reason of item.provider.blocker_codes) {
      blockers.push(reason + ':' + item.configured_url);
    }
  }

  const matchingCanonical = amountMatchedIdentityCandidates.length === 1
    ? amountMatchedIdentityCandidates[0]
    : null;
  if (!matchingCanonical) {
    if (amountMatchedIdentityCandidates.length > 1) blockers.push('MULTIPLE_ACTIVE_STRIPE_LINKS_MATCH_OFFER_IDENTITY_AND_PRICE');
    else if (canonicalIdentityCandidates.length === 0) blockers.push('NO_STRIPE_LINK_MATCHES_OFFER_METADATA');
    else blockers.push('NO_UNIQUE_ACTIVE_STRIPE_LINK_MATCHES_OFFER_IDENTITY_AND_PRICE');
  }

  if (!fulfillmentEntry) blockers.push('FULFILLMENT_REGISTRY_ENTRY_MISSING');
  else {
    if (fulfillmentEntry.ready !== true) blockers.push('FULFILLMENT_REGISTRY_NOT_READY');
    if (fulfillmentEntry.operator_required === true) blockers.push('FULFILLMENT_REQUIRES_OPERATOR');
  }
  if (publicPage && publicPage.checkout_held === true) blockers.push('PUBLIC_PURCHASE_ROUTE_HELD');
  if (!asText(offer.fulfillment_route)) blockers.push('FULFILLMENT_ROUTE_MISSING');
  if (!asText(offer.proof_of_delivery)) blockers.push('DELIVERY_PROOF_CONTRACT_MISSING');

  const uniqueBlockers = [...new Set(blockers)];
  const firstDivergence = uniqueBlockers[0] || null;

  return {
    schema: 'DREAMLEDGER/777/STRIPE-OFFER-PARITY/v1',
    sku: firstText(offer.product_sku, offer.sku, offer.product_id),
    offer_id: offer.offer_id || null,
    product_id: offer.product_id || null,
    silo: offer.silo || null,
    resolved_at: new Date().toISOString(),
    expected: {
      amount_minor: expectedAmountMinor,
      amount_nzd: expectedAmountMinor == null ? null : expectedAmountMinor / 100,
      currency: expectedCurrency,
      api_mode: apiMode || 'UNKNOWN'
    },
    surfaces: {
      approved_catalogue: { url: approvedUrl, amount_minor: expectedAmountMinor, currency: expectedCurrency },
      live_commerce: {
        url: liveUrl,
        amount_minor: nzdToMinor(liveOffer && liveOffer.price_nzd),
        currency: expectedCurrency,
        status: liveOffer && liveOffer.status || null
      },
      public_catalogue: {
        url: publicUrl,
        amount_minor: publicProduct ? nzdToMinor(publicProduct.price_nzd ?? publicProduct.price) : null,
        currency: normalizeCurrency(publicProduct && publicProduct.currency || '') || null,
        status: publicProduct && publicProduct.status || null,
        checkout_available: publicProduct ? publicProduct.checkout_available ?? null : null
      },
      public_page: publicPage || null,
      stripe_provider: {
        lookup_method: 'EXACT_URL_MATCH_THEN_OFFER_METADATA_CROSS_CHECK',
        configured_link_checks: surfaceProviderChecks,
        unique_active_identity_and_price_matches: amountMatchedIdentityCandidates.length,
        canonical_candidate: matchingCanonical ? matchingCanonical.inspection : null,
        identity_candidates: canonicalIdentityCandidates.map(item => item.inspection)
      },
      fulfillment_registry: fulfillmentEntry ? {
        ready: fulfillmentEntry.ready === true,
        operator_required: fulfillmentEntry.operator_required === true,
        type: fulfillmentEntry.type || null,
        delivery_target: fulfillmentEntry.delivery_target || null
      } : null
    },
    coherent: uniqueBlockers.length === 0,
    first_divergence: firstDivergence,
    blocker_codes: uniqueBlockers,
    verified_revenue_nzd: 0,
    revenue_claim_permitted: false,
    external_action: 'NONE'
  };
}

module.exports = { nzdToMinor, metadataIdentityMatches, inspectStripeLink, buildOfferParityReceipt };
