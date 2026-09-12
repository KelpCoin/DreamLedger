#!/usr/bin/env node
'use strict';

/*
DreamLedger Economic Cockpit

Purpose:
  One local command that answers the only question that matters:
  can DreamLedger observe a valid commercial rail, and if yes, what is
  the nearest money action?

Mandatory observation:
  - production root
  - billboard page
  - offers endpoint
  - Stripe charges endpoint
  - payment evidence derived from Stripe charges

Status rules:
  connectivity failure -> INVALID
  5xx -> INVALID
  4xx -> CONTRADICTED
  valid Stripe response with zero paid live charges -> VALID / NZ$0

Optional observation:
  - Stripe Payment Link contract
  - Supabase bridge
  - Truth Oracle
  - SEO surfaces

Acquisition:
  - reads a CSV prospect feed when present
  - scores and prepares opportunities
  - never sends outreach
  - never creates payments
  - never deploys

No external dependencies. Node 20+.
*/

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BASE_URL = String(process.env.DREAMLEDGER_BASE_URL || 'https://dreamledger.org').replace(/\/$/, '');
const BILLBOARD_PATH = process.env.DREAMLEDGER_BILLBOARD_PATH || '/billboard';
const OFFERS_PATH = process.env.DREAMLEDGER_OFFERS_PATH || '/api/offers';
const TRUTH_PATH = process.env.DREAMLEDGER_TRUTH_PATH || '/truth-oracle';
const BILLBOARD_SKU = process.env.DREAMLEDGER_BILLBOARD_SKU || 'DL-BILLBOARD-100X100-3000-001';
const BILLBOARD_OFFER_ID = 'OFFER-DREAMLEDGER-BILLBOARD-FOUNDING-001';
const EXPECTED_AMOUNT_CENTS = 5000;
const BRIDGE_TABLE = process.env.DREAMLEDGER_BRIDGE_TABLE || 'control_bridge_notes';
const BRIDGE_CORRELATION = process.env.DREAMLEDGER_BRIDGE_CORRELATION || 'UNIFIED-STOREFRONT-20260912';

const COCKPIT_ROOT = process.env.DREAMLEDGER_COCKPIT_ROOT || path.join('D:\\BrownEyeCortex', 'EconomicCockpit');
const PROSPECTS_CSV = process.env.DREAMLEDGER_PROSPECTS_CSV || path.join('D:\\BrownEyeCortex', 'Prospects', 'prospects.csv');

const RUN_ID = `COCKPIT-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}-${crypto.randomBytes(4).toString('hex')}`;
const RUN_DIR = path.join(COCKPIT_ROOT, RUN_ID);

const invalidReasons = [];
const evidence = {};

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function csvRows(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = lines.shift().split(',').map(x => x.trim().replace(/^"|"$/g, ''));
  return lines.map(line => {
    const out = {};
    let cell = '';
    let quoted = false;
    const cells = [];
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"') {
        if (quoted && line[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = !quoted;
        }
      } else if (ch === ',' && !quoted) {
        cells.push(cell);
        cell = '';
      } else {
        cell += ch;
      }
    }
    cells.push(cell);
    headers.forEach((h, i) => {
      out[h] = String(cells[i] || '').trim();
    });
    return out;
  });
}

function csvEscape(value) {
  const s = String(value == null ? '' : value);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

async function requestJson(url, options = {}) {
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        accept: 'application/json,text/plain;q=0.9,*/*;q=0.8',
        ...(options.headers || {})
      },
      signal: AbortSignal.timeout(20000)
    });
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch (_) {}
    return {
      ok: true,
      status: res.status,
      content: text,
      json,
      headers: Object.fromEntries(res.headers.entries())
    };
  } catch (error) {
    return { ok: false, status: null, content: '', json: null, error: error.message };
  }
}

function classifyMandatory(resp, label, url) {
  if (!resp.ok) {
    invalidReasons.push(`Connectivity failed: ${label} ${url} :: ${resp.error}`);
    return 'INVALID';
  }
  if (resp.status >= 500) {
    invalidReasons.push(`Server error ${resp.status}: ${label} ${url}`);
    return 'INVALID';
  }
  if (resp.status >= 400) return 'CONTRADICTED';
  return 'REACHABLE';
}

function extractOffers(json) {
  if (Array.isArray(json)) return json;
  if (json && Array.isArray(json.offers)) return json.offers;
  if (json && Array.isArray(json.data)) return json.data;
  if (json && typeof json === 'object') return [json];
  return [];
}

function scoreProspect(p) {
  let score = 0;
  const reasons = [];
  if (/\bnz\b|new zealand/i.test(p.country || p.market || p.location || '')) {
    score += 20; reasons.push('NZ market signal');
  }
  if (/^https?:\/\//i.test(p.website || '')) {
    score += 15; reasons.push('live website supplied');
  }
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(p.email || '')) {
    score += 20; reasons.push('direct email supplied');
  }
  if (/^true|yes|y|1$/i.test(p.website_active || '')) {
    score += 10; reasons.push('website marked active');
  }
  if ((p.reason || p.qualification_reason || '').trim()) {
    score += 20; reasons.push('qualification reason supplied');
  }
  if (/advert|marketing|brand|design|ecommerce|shop|studio|agency|solar|pool|cabins|digital|matcha/i.test(`${p.name || ''} ${p.reason || ''} ${p.website || ''}`)) {
    score += 15; reasons.push('commercial relevance signal');
  }
  return { score: Math.min(score, 100), reasons };
}

async function main() {
  ensureDir(RUN_DIR);

  const health = {
    run_id: RUN_ID,
    node: process.version,
    base_url: BASE_URL,
    stripe_key_present: Boolean(process.env.STRIPE_SECRET_KEY),
    supabase_url_present: Boolean(process.env.SUPABASE_URL),
    supabase_key_present: Boolean(process.env.SUPABASE_SERVICE_KEY)
  };

  evidence.health = health;

  const rootUrl = BASE_URL;
  const billboardUrl = BASE_URL + BILLBOARD_PATH;
  const offersUrl = BASE_URL + OFFERS_PATH;
  const chargesUrl = 'https://api.stripe.com/v1/charges?limit=100';

  const [root, billboard, offers] = await Promise.all([
    requestJson(rootUrl),
    requestJson(billboardUrl),
    requestJson(offersUrl)
  ]);

  evidence.production = {
    root: { class: classifyMandatory(root, 'root', rootUrl), ok: root.ok, status: root.status, error: root.error },
    billboard: { class: classifyMandatory(billboard, 'billboard', billboardUrl), ok: billboard.ok, status: billboard.status, error: billboard.error },
    offers: { class: classifyMandatory(offers, 'offers', offersUrl), ok: offers.ok, status: offers.status, error: offers.error }
  };

  const offerCandidates = extractOffers(offers.json);
  const billboardOffer = offerCandidates.find(o =>
    String(o.sku || '') === BILLBOARD_SKU || String(o.offer_id || '') === BILLBOARD_OFFER_ID
  ) || null;

  evidence.billboard_offer = billboardOffer ? {
    found: true,
    sku: billboardOffer.sku || null,
    offer_id: billboardOffer.offer_id || null,
    price_nzd: billboardOffer.price_nzd ?? null,
    payment_link: billboardOffer.payment_link || billboardOffer.stripe_payment_link_id || null
  } : { found: false };

  const stripeKey = process.env.STRIPE_SECRET_KEY || '';
  const charges = await requestJson(chargesUrl, {
    headers: stripeKey ? { authorization: `Bearer ${stripeKey}` } : {}
  });
  const chargesClass = stripeKey
    ? classifyMandatory(charges, 'Stripe charges', chargesUrl)
    : 'INVALID';
  if (!stripeKey) invalidReasons.push('STRIPE_SECRET_KEY is missing; payment evidence cannot be observed.');

  let paid = [];
  if (chargesClass === 'REACHABLE' && charges.json && Array.isArray(charges.json.data)) {
    paid = charges.json.data.filter(c => c.livemode === true && c.paid === true && c.refunded !== true);
  } else if (chargesClass === 'REACHABLE') {
    invalidReasons.push('Stripe charges response did not contain a data array.');
  }

  const paidCount = paid.length;
  const currencies = [...new Set(paid.map(c => String(c.currency || '').toLowerCase()))].filter(Boolean);
  const grossMinor = paid.reduce((sum, c) => sum + Number(c.amount || 0), 0);
  evidence.payment = {
    probe: chargesClass,
    paid_charge_count: paidCount,
    currencies,
    gross_paid_nzd: currencies.length === 1 && currencies[0] === 'nzd' ? Math.round(grossMinor) / 100 : null,
    status: chargesClass !== 'REACHABLE' ? chargesClass : paidCount ? 'VERIFIED_PAYMENT_EVIDENCE_PRESENT' : 'VERIFIED_ZERO_PAID_CHARGES'
  };

  const checkout = { status: 'UNVERIFIED_NOT_TESTED' };
  const paymentLinkId = billboardOffer && (billboardOffer.payment_link || billboardOffer.stripe_payment_link_id);
  if (stripeKey && paymentLinkId) {
    const linkUrl = `https://api.stripe.com/v1/payment_links/${encodeURIComponent(String(paymentLinkId))}?expand[]=line_items.data.price`;
    const link = await requestJson(linkUrl, { headers: { authorization: `Bearer ${stripeKey}` } });
    if (!link.ok) checkout.status = 'UNVERIFIED_CONNECTIVITY_FAILURE';
    else if (link.status >= 500) checkout.status = 'UNVERIFIED_SERVER_ERROR';
    else if (link.status >= 400) checkout.status = 'CONTRADICTED_4XX';
    else if (link.json) {
      const item = Array.isArray(link.json.line_items?.data) ? link.json.line_items.data[0] : null;
      const price = item?.price || null;
      const amount = price?.unit_amount ?? null;
      const currency = String(price?.currency || '').toLowerCase();
      const testMode = link.json.livemode === false;
      checkout.amount_cents = amount;
      checkout.currency = currency || null;
      checkout.test_mode = testMode;
      checkout.status = !testMode && amount === EXPECTED_AMOUNT_CENTS && currency === 'nzd' ? 'VERIFIED' : testMode ? 'CONTRADICTED_TEST_MODE' : amount != null && amount !== EXPECTED_AMOUNT_CENTS ? 'CONTRADICTED_PRICE_MISMATCH' : 'UNVERIFIED_INCOMPLETE';
    }
  }
  evidence.checkout = checkout;

  const optionalTruth = await requestJson(BASE_URL + TRUTH_PATH);
  evidence.truth_oracle = optionalTruth.ok && optionalTruth.status < 400
    ? { status: 'VERIFIED_REACHABLE', status_code: optionalTruth.status }
    : { status: 'UNVERIFIED', status_code: optionalTruth.status, error: optionalTruth.error };

  let prospects = [];
  if (fs.existsSync(PROSPECTS_CSV)) {
    prospects = csvRows(fs.readFileSync(PROSPECTS_CSV, 'utf8'));
  }

  const qualified = prospects
    .map((p) => {
      const scored = scoreProspect(p);
      const idSeed = `${p.name || ''}|${p.website || ''}|${p.email || ''}`;
      return {
        opportunity_id: `OPP-${sha256(idSeed).slice(0, 12).toUpperCase()}`,
        offer_sku: BILLBOARD_SKU,
        business: p.name || p.business || '',
        website: p.website || '',
        email: p.email || '',
        score: scored.score,
        qualification: scored.reasons,
        status: p.status || 'READY_FOR_REVIEW',
        approval_required: true,
        send_status: 'NOT_SENT'
      };
    })
    .sort((a, b) => b.score - a.score);

  const acquisition = {
    source: fs.existsSync(PROSPECTS_CSV) ? PROSPECTS_CSV : null,
    discovered: prospects.length,
    qualified: qualified.filter(x => x.score >= 50).length,
    high_priority: qualified.filter(x => x.score >= 70).length,
    approval_required: qualified.filter(x => x.score >= 50).length,
    opportunities: qualified.slice(0, 100)
  };
  evidence.acquisition = acquisition;

  const mandatoryValid =
    invalidReasons.length === 0 &&
    evidence.production.root.class !== 'CONTRADICTED' &&
    evidence.production.billboard.class !== 'CONTRADICTED' &&
    evidence.production.offers.class !== 'CONTRADICTED' &&
    evidence.payment.probe === 'REACHABLE';

  let nextAction;
  if (!mandatoryValid) {
    nextAction = {
      code: 'REPAIR_MANDATORY_OBSERVATION',
      approval_required: false,
      action: 'Repair the mandatory observation layer. No economic verdict is valid from this run.'
    };
  } else if (!billboardOffer) {
    nextAction = {
      code: 'FIX_BILLBOARD_OFFER',
      approval_required: false,
      action: 'Repair the machine-readable Founding Billboard offer.'
    };
  } else if (checkout.status !== 'VERIFIED') {
    nextAction = {
      code: 'FIX_BILLBOARD_CHECKOUT',
      approval_required: false,
      action: 'Repair the NZ$50 live Stripe checkout contract.'
    };
  } else if (evidence.payment.status === 'VERIFIED_ZERO_PAID_CHARGES') {
    nextAction = {
      code: 'BUYER_ACQUISITION',
      approval_required: true,
      action: `Approve the strongest ${Math.min(acquisition.high_priority || acquisition.qualified || 0, 10)} qualified Billboard opportunities, then send the approved outreach.`
    };
  } else {
    nextAction = {
      code: 'FULFILMENT_AND_PROOF',
      approval_required: false,
      action: 'Reconcile the live payment to fulfilment and generate proof.'
    };
  }

  const report = {
    schema_version: 'BEC-ECONOMIC-COCKPIT-1.0',
    run_id: RUN_ID,
    generated_at: new Date().toISOString(),
    run_status: invalidReasons.length ? 'INVALID' : 'VALID',
    invalid_reasons: invalidReasons,
    verified_revenue_nzd: evidence.payment.gross_paid_nzd || 0,
    paid_charge_count: paidCount,
    production_status: evidence.production.root.class === 'REACHABLE' && evidence.production.billboard.class === 'REACHABLE' && evidence.production.offers.class === 'REACHABLE' ? 'VERIFIED' : 'CONTRADICTED_OR_INVALID',
    billboard_offer: evidence.billboard_offer,
    checkout_status: checkout.status,
    payment_status: evidence.payment.status,
    acquisition: {
      discovered: acquisition.discovered,
      qualified: acquisition.qualified,
      high_priority: acquisition.high_priority,
      approval_required: acquisition.approval_required
    },
    next_action: nextAction,
    optional: {
      truth_oracle: evidence.truth_oracle
    },
    doctrine: {
      business_truth: 'STRIPE_LIVE_PAYMENT_EVIDENCE_ONLY',
      outreach_sent: false,
      payment_created: false,
      deployment_performed: false,
      mtg_resurrected: false
    }
  };

  writeJson(path.join(RUN_DIR, '01_health.json'), health);
  writeJson(path.join(RUN_DIR, '02_production.json'), evidence.production);
  writeJson(path.join(RUN_DIR, '03_billboard_offer.json'), evidence.billboard_offer);
  writeJson(path.join(RUN_DIR, '04_checkout.json'), evidence.checkout);
  writeJson(path.join(RUN_DIR, '05_payment.json'), evidence.payment);
  writeJson(path.join(RUN_DIR, '06_acquisition.json'), acquisition);
  writeJson(path.join(RUN_DIR, '07_report.json'), report);

  const queueHeader = ['opportunity_id', 'offer_sku', 'business', 'website', 'email', 'score', 'status', 'approval_required', 'send_status', 'qualification'];
  const queueLines = [queueHeader.join(',')];
  for (const o of acquisition.opportunities) {
    queueLines.push([
      o.opportunity_id,
      o.offer_sku,
      o.business,
      o.website,
      o.email,
      o.score,
      o.status,
      o.approval_required,
      o.send_status,
      o.qualification.join('; ')
    ].map(csvEscape).join(','));
  }
  fs.writeFileSync(path.join(RUN_DIR, 'OUTREACH_QUEUE.csv'), queueLines.join('\n') + '\n', 'utf8');
  writeJson(path.join(COCKPIT_ROOT, 'latest.json'), report);

  console.log('');
  console.log('============================================================');
  console.log('DREAMLEDGER ECONOMIC COCKPIT');
  console.log('============================================================');
  console.log(`Status:             ${report.run_status}`);
  console.log(`Revenue:            NZ$${report.verified_revenue_nzd}`);
  console.log(`Paid live charges:  ${report.paid_charge_count}`);
  console.log(`Production:         ${report.production_status}`);
  console.log(`Billboard offer:    ${billboardOffer ? 'DISCOVERED' : 'NOT DISCOVERED'}`);
  console.log(`Checkout:            ${checkout.status}`);
  console.log(`Prospects:           ${acquisition.discovered}`);
  console.log(`Qualified:           ${acquisition.qualified}`);
  console.log(`High priority:       ${acquisition.high_priority}`);
  console.log('');
  console.log(`NEXT ACTION: ${nextAction.action}`);
  console.log(`Approval required: ${nextAction.approval_required}`);
  console.log(`Evidence: ${RUN_DIR}`);

  if (invalidReasons.length) {
    console.log('');
    console.log('NO ECONOMIC VERDICT IS VALID FROM THIS RUN.');
    for (const reason of invalidReasons) console.log(`- ${reason}`);
    process.exitCode = 2;
  }
}

main().catch(error => {
  console.error('ECONOMIC COCKPIT ERROR');
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
