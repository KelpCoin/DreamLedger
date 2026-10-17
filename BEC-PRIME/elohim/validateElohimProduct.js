'use strict';

/**
 * Automated schema + commercial rules for Elohim outputs.
 * Generation does not imply publish. checkout_available requires a live Stripe URL.
 */

const path = require('path');
const fs = require('fs');

const ALLOWED_SILOS = Object.freeze(['mtg', 'crypto', 'media_music', 'digital_products', 'dreamledger']);
const PUBLISHABLE_SILOS = Object.freeze(['mtg', 'crypto', 'media_music', 'digital_products']);

const PRICE_FLOORS_NZD = Object.freeze({
  mtg: 3,
  crypto: 5,
  media_music: 3,
  digital_products: 3,
  dreamledger: 3,
  default: 3
});

function loadSchema(name) {
  const file = path.join(__dirname, '..', 'schemas', name);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

let _ajvValidateProduct = null;
let _ajvValidateCandidate = null;

function getAjvValidators() {
  if (_ajvValidateProduct && _ajvValidateCandidate) {
    return { product: _ajvValidateProduct, candidate: _ajvValidateCandidate };
  }
  let Ajv;
  try {
    Ajv = require('ajv/dist/2020');
  } catch (_)
  {
    return null;
  }
  const ajv = new Ajv({ allErrors: true, strict: false });
  _ajvValidateProduct = ajv.compile(loadSchema('elohim-product.schema.json'));
  _ajvValidateCandidate = ajv.compile(loadSchema('elohim-candidate.schema.json'));
  return { product: _ajvValidateProduct, candidate: _ajvValidateCandidate };
}

function push(errors, code, message, pathHint) {
  errors.push({ code, message, path: pathHint || null });
}

function isStripeCheckoutUrl(url) {
  if (typeof url !== 'string' || !url) return false;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && (u.hostname === 'buy.stripe.com' || u.hostname === 'checkout.stripe.com');
  } catch (_) {
    return false;
  }
}

function normalizeSilo(silo) {
  const s = String(silo || '').trim().toLowerCase();
  if (ALLOWED_SILOS.includes(s)) return s;
  return null;
}

function resolveCheckoutUrl(product) {
  if (product.checkout_url) return product.checkout_url;
  if (product.checkout && product.checkout.url) return product.checkout.url;
  if (product.commercial_truth && product.commercial_truth.payment_link) {
    return product.commercial_truth.payment_link;
  }
  return null;
}

function priceMajorNzd(product) {
  const value = Number(product.price);
  if (!Number.isFinite(value)) return null;
  const unit = String(product.price_unit || 'major').toLowerCase();
  if (unit === 'minor' || unit === 'cents') return value / 100;
  return value;
}

/**
 * Validate a catalog-shaped product (compiled / silo inventory item).
 * @returns {{ ok: boolean, errors: Array, warnings: Array, silo: string|null, price_major_nzd: number|null }}
 */
function validateCatalogProduct(product, options = {}) {
  const errors = [];
  const warnings = [];
  const requirePublishable = options.requirePublishable === true;

  if (!product || typeof product !== 'object') {
    return { ok: false, errors: [{ code: 'NOT_OBJECT', message: 'Product must be an object', path: null }], warnings, silo: null, price_major_nzd: null };
  }

  const ajvPair = getAjvValidators();
  if (ajvPair) {
    const valid = ajvPair.product(product);
    if (!valid) {
      for (const e of ajvPair.product.errors || []) {
        push(errors, 'SCHEMA', `${e.instancePath || '/'} ${e.message}`, e.instancePath || null);
      }
    }
  } else {
    // Minimal fallback without ajv
    if (!product.id) push(errors, 'REQUIRED', 'id is required', '/id');
    if (!product.name) push(errors, 'REQUIRED', 'name is required', '/name');
    if (product.price === undefined || product.price === null) push(errors, 'REQUIRED', 'price is required', '/price');
    if (!product.currency) push(errors, 'REQUIRED', 'currency is required', '/currency');
    if (!product.status) push(errors, 'REQUIRED', 'status is required', '/status');
    if (!product.silo) push(errors, 'REQUIRED', 'silo is required', '/silo');
  }

  const silo = normalizeSilo(product.silo);
  if (!silo) {
    push(errors, 'SILO', `silo must be one of ${ALLOWED_SILOS.join(', ')}`, '/silo');
  } else if (requirePublishable && !PUBLISHABLE_SILOS.includes(silo)) {
    push(errors, 'SILO_HOST', 'dreamledger host silo is not a cloneable commercial silo; map to digital_products or another allowed silo', '/silo');
  }

  const currency = String(product.currency || '').toLowerCase();
  if (currency && currency !== 'nzd') {
    push(errors, 'CURRENCY', 'currency must be nzd', '/currency');
  }

  const major = priceMajorNzd(product);
  if (major === null) {
    push(errors, 'PRICE', 'price must be a finite number', '/price');
  } else {
    const floor = PRICE_FLOORS_NZD[silo] || PRICE_FLOORS_NZD.default;
    if (major < floor) {
      push(errors, 'PRICE_FLOOR', `price NZ$${major} is below floor NZ$${floor} for silo ${silo || 'unknown'}`, '/price');
    }
    if (major === 0 && product.status === 'published') {
      push(errors, 'PRICE_ZERO', 'published products cannot be price 0', '/price');
    }
  }

  const checkoutUrl = resolveCheckoutUrl(product);
  const checkoutAvailable = product.checkout_available === true
    || (product.checkout && product.checkout.mode === 'stripe' && product.checkout.url)
    || (product.status === 'published' && product.sale_mode === 'checkout');

  if (product.checkout_available === true && !isStripeCheckoutUrl(checkoutUrl)) {
    push(errors, 'CHECKOUT_URL', 'checkout_available requires a valid https Stripe checkout/payment link', '/checkout_url');
  }

  if (product.status === 'published') {
    if (!product.description) warnings.push({ code: 'DESC', message: 'published product missing description', path: '/description' });
    if (Number(product.inventory) > 0 && !product.evidence && product.inventory_type !== 'digital') {
      warnings.push({ code: 'INVENTORY_EVIDENCE', message: 'physical inventory claimed without evidence object', path: '/inventory' });
    }
  }

  if (product.status === 'published' && product.checkout_available === true && !isStripeCheckoutUrl(checkoutUrl)) {
    push(errors, 'PUBLISH_CHECKOUT', 'cannot publish with checkout_available without Stripe URL', '/checkout_url');
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    silo,
    price_major_nzd: major
  };
}

/**
 * Validate an ElohimCreate candidate before any catalog write.
 */
function validateElohimCandidate(candidate) {
  const errors = [];
  const warnings = [];

  if (!candidate || typeof candidate !== 'object') {
    return { ok: false, errors: [{ code: 'NOT_OBJECT', message: 'Candidate must be an object', path: null }], warnings };
  }

  const ajvPair = getAjvValidators();
  if (ajvPair) {
    const valid = ajvPair.candidate(candidate);
    if (!valid) {
      for (const e of ajvPair.candidate.errors || []) {
        push(errors, 'SCHEMA', `${e.instancePath || '/'} ${e.message}`, e.instancePath || null);
      }
    }
  }

  if (candidate.created_by !== 'ELOHIM') {
    push(errors, 'PROVENANCE', 'created_by must be ELOHIM', '/created_by');
  }
  if (candidate.checkout_available === true) {
    push(errors, 'CHECKOUT_GATE', 'Elohim candidates must not set checkout_available true; human/Stripe gate required', '/checkout_available');
  }
  if (candidate.approval_required !== true) {
    push(errors, 'APPROVAL', 'approval_required must be true for Elohim candidates', '/approval_required');
  }

  const silo = normalizeSilo(candidate.silo);
  if (!silo) {
    push(errors, 'SILO', `silo must be one of ${ALLOWED_SILOS.join(', ')}`, '/silo');
  }

  const prices = Array.isArray(candidate.price_proposal_nzd) ? candidate.price_proposal_nzd : [];
  if (!prices.length) {
    push(errors, 'PRICE', 'price_proposal_nzd must be a non-empty array', '/price_proposal_nzd');
  } else {
    const floor = PRICE_FLOORS_NZD[silo] || PRICE_FLOORS_NZD.default;
    for (let i = 0; i < prices.length; i++) {
      const p = Number(prices[i]);
      if (!Number.isFinite(p) || p <= 0) {
        push(errors, 'PRICE', `price_proposal_nzd[${i}] must be > 0`, `/price_proposal_nzd/${i}`);
      } else if (p < floor) {
        push(errors, 'PRICE_FLOOR', `price_proposal_nzd[${i}] NZ$${p} below floor NZ$${floor}`, `/price_proposal_nzd/${i}`);
      }
    }
  }

  if (candidate.public_execution && candidate.public_execution !== 'HUMAN_GATE_REQUIRED') {
    warnings.push({ code: 'PUBLIC_EXEC', message: 'public_execution should remain HUMAN_GATE_REQUIRED until approved', path: '/public_execution' });
  }

  return { ok: errors.length === 0, errors, warnings, silo };
}

/**
 * Map candidate → draft catalog product (still unpublished).
 */
function candidateToDraftProduct(candidate, overrides = {}) {
  const v = validateElohimCandidate(candidate);
  if (!v.ok) {
    const err = new Error('Elohim candidate failed schema validation');
    err.validation = v;
    throw err;
  }
  const price = Number(candidate.price_proposal_nzd[0]);
  const silo = normalizeSilo(candidate.silo) || 'digital_products';
  const product = {
    id: candidate.id,
    sku: overrides.sku || null,
    capability_id: candidate.capability_id || null,
    silo: silo === 'dreamledger' ? 'digital_products' : silo,
    name: candidate.name,
    description: candidate.deliverable || candidate.problem || candidate.name,
    price,
    price_unit: 'major',
    currency: 'nzd',
    inventory: 0,
    inventory_type: 'digital',
    status: 'draft',
    checkout_available: false,
    checkout_url: null,
    sale_mode: 'disabled',
    checkout: { mode: 'disabled', url: null },
    commercial_truth: {
      approval_required: true,
      sellable: false,
      reason: 'Elohim draft — not authorized for public sale until price, Stripe, and fulfillment gates pass.'
    },
    created_by: 'ELOHIM',
    elohim_candidate_id: candidate.id,
    validation: { schema: 'elohim-product', at: new Date().toISOString() },
    ...overrides
  };
  const productValidation = validateCatalogProduct(product);
  if (!productValidation.ok) {
    const err = new Error('Draft product failed schema validation');
    err.validation = productValidation;
    throw err;
  }
  return product;
}

function assertValidProduct(product, options) {
  const result = validateCatalogProduct(product, options);
  if (!result.ok) {
    const err = new Error(`Product schema validation failed: ${result.errors.map(e => e.code).join(',')}`);
    err.validation = result;
    throw err;
  }
  return result;
}

module.exports = {
  ALLOWED_SILOS,
  PUBLISHABLE_SILOS,
  PRICE_FLOORS_NZD,
  validateCatalogProduct,
  validateElohimCandidate,
  candidateToDraftProduct,
  assertValidProduct,
  isStripeCheckoutUrl,
  normalizeSilo
};
