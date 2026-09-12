#!/usr/bin/env node
'use strict';

/*
DreamLedger Economic Cockpit 2.0

Economic truth:
  settled live Stripe payment attributable to the active DreamLedger
  checkout only. Account-wide Stripe charges are never counted as
  DreamLedger revenue.

Safety:
  - read-only observation
  - no outreach
  - no payment creation
  - no deployment
  - approval is a frozen authorization record, not a boolean flag
  - Billboard is the active commercial cell; MTG is excluded

Node 20+ / no external dependencies.
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
const COCKPIT_ROOT = process.env.DREAMLEDGER_COCKPIT_ROOT || path.join('D:\\BrownEyeCortex', 'EconomicCockpit');
const PROSPECTS_CSV = process.env.DREAMLEDGER_PROSPECTS_CSV || path.join('D:\\BrownEyeCortex', 'Prospects', 'prospects.csv');
const APPROVAL_TTL_HOURS = Number(process.env.DREAMLEDGER_APPROVAL_TTL_HOURS || 72);

const RUN_ID = `COCKPIT-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}-${crypto.randomBytes(4).toString('hex')}`;
const RUN_DIR = path.join(COCKPIT_ROOT, RUN_ID);
const invalidReasons = [];
const evidence = {};

function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); }
function sha256(value) { return crypto.createHash('sha256').update(String(value)).digest('hex'); }
function writeJson(file, data) { fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8'); }

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
        if (quoted && line[i + 1] === '"') { cell += '"'; i += 1; }
        else quoted = !quoted;
      } else if (ch === ',' && !quoted) { cells.push(cell); cell = ''; }
      else cell += ch;
    }
    cells.push(cell);
    headers.forEach((h, i) => { out[h] = String(cells[i] || '').trim(); });
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
      headers: { accept: 'application/json,text/plain;q=0.9,*/*;q=0.8', ...(options.headers || {}) },
      signal: AbortSignal.timeout(20000)
    });
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch (_) {}
    return { ok: true, status: res.status, content: text, json, headers: Object.fromEntries(res.headers.entries()) };
  } catch (error) {
    return { ok: false, status: null, content: '', json: null, error: error.message };
  }
}

function classify(resp, label, url) {
  if (!resp.ok) { invalidReasons.push(`Connectivity failed: ${label} ${url} :: ${resp.error}`); return 'INVALID'; }
  if (resp.status >= 500) { invalidReasons.push(`Server error ${resp.status}: ${label} ${url}`); return 'INVALID'; }
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

function normalizePaymentLinkId(value) {
  const raw = String(value || '').trim();
  const match = raw.match(/(plink_[A-Za-z0-9]+)/);
  return match ? match[1] : raw;
}

function scoreProspect(p) {
  let fit = 0;
  const fitReasons = [];
  if (/\bnz\b|new zealand/i.test(p.country || p.market || p.location || '')) { fit += 20; fitReasons.push('NZ market'); }
  if (/^https?:\/\//i.test(p.website || '')) { fit += 15; fitReasons.push('live website'); }
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(p.email || '')) { fit += 20; fitReasons.push('direct email'); }
  if (/^true|yes|y|1$/i.test(p.website_active || '')) { fit += 10; fitReasons.push('website active'); }
  if (/advert|marketing|brand|design|ecommerce|shop|studio|agency|solar|pool|cabins|digital|matcha/i.test(`${p.name || ''} ${p.reason || ''} ${p.website || ''}`)) { fit += 15; fitReasons.push('commercial relevance'); }

  let intent = Number(p.intent_score || 0);
  if (!Number.isFinite(intent)) intent = 0;
  const intentReasons = [];
  const signals = String(p.intent_signals || p.intent || '').split(/[;|]/).map(x => x.trim()).filter(Boolean);
  signals.forEach(s => intentReasons.push(s));
  if (/hiring|funding|launch|new website|rebrand|marketing|advertising|promotion|opening|expansion|purchase|bought|campaign/i.test(`${p.intent_signals || ''} ${p.reason || ''}`)) {
    intent = Math.max(intent, 70);
    if (!intentReasons.length) intentReasons.push('recent commercial activity signal');
  }
  if (p.intent_date) {
    const days = (Date.now() - Date.parse(p.intent_date)) / 86400000;
    if (Number.isFinite(days) && days >= 0 && days <= 30) intent = Math.min(100, intent + 15);
  }

  let engagement = Number(p.engagement_score || 0);
  if (!Number.isFinite(engagement)) engagement = 0;
  const engagementReasons = [];
  if (p.engagement_signal) engagementReasons.push(String(p.engagement_signal));
  if (/click|visit|reply|inbound|referr|form|download|view/i.test(String(p.engagement_signal || ''))) engagement = Math.max(engagement, 70);

  return {
    fit_score: Math.min(fit, 100),
    intent_score: Math.min(intent, 100),
    engagement_score: Math.min(engagement, 100),
    fit_reasons: fitReasons,
    intent_reasons: intentReasons,
    engagement_reasons: engagementReasons,
    outreach_trigger: fit >= 50 && intent >= 60,
    score: Math.min(100, Math.round((intent * 0.5) + (fit * 0.35) + (engagement * 0.15)))
  };
}

function authorizationFor(p, runId) {
  const created = new Date().toISOString();
  const expires = new Date(Date.now() + APPROVAL_TTL_HOURS * 3600000).toISOString();
  const body = p.message_body || `Hi - I run dreamledger.org. I have one permanent 100x100 tile available on the front page. NZ$50, one-time, stays there. No ongoing fees, no subscription, no account required. If you want it, here is the link: ${p.payment_link || '[LIVE_STRIPE_PAYMENT_LINK]'}. If not, no follow-up from me.`;
  const snapshot = {
    action_type: 'OUTREACH_BILLBOARD_FOUNDING_TILE',
    recipient: p.email || '',
    recipient_hash: sha256(p.email || ''),
    amount: '50.00',
    currency: 'NZD',
    offer_sku: BILLBOARD_SKU,
    payment_link: p.payment_link || '',
    message_body: body,
    message_hash: sha256(body),
    created_at: created,
    expires_at: expires,
    nonce: crypto.randomBytes(16).toString('hex'),
    source_opportunity_id: p.opportunity_id,
    run_id: runId
  };
  const payloadHash = sha256(JSON.stringify(snapshot));
  return {
    schema_version: 'BEC-AUTHORIZATION-1.0',
    authorization_id: `AUTH-${payloadHash.slice(0, 16).toUpperCase()}`,
    approval_status: 'PENDING',
    immutable_snapshot: snapshot,
    payload_hash: payloadHash,
    approved_at: null,
    approved_by: null,
    approval_signature: null
  };
}

async function main() {
  ensureDir(RUN_DIR);
  const readKey = process.env.STRIPE_READONLY_KEY || '';
  const legacyKeyPresent = Boolean(process.env.STRIPE_SECRET_KEY);
  const health = {
    run_id: RUN_ID,
    node: process.version,
    base_url: BASE_URL,
    stripe_readonly_key_present: Boolean(readKey),
    legacy_stripe_secret_key_present: legacyKeyPresent,
    supabase_url_present: Boolean(process.env.SUPABASE_URL),
    supabase_key_present: Boolean(process.env.SUPABASE_SERVICE_KEY)
  };
  evidence.health = health;
  if (legacyKeyPresent) invalidReasons.push('STRIPE_SECRET_KEY is prohibited for the economic cockpit; use STRIPE_READONLY_KEY.');

  const rootUrl = BASE_URL;
  const billboardUrl = BASE_URL + BILLBOARD_PATH;
  const offersUrl = BASE_URL + OFFERS_PATH;
  const [root, billboard, offers] = await Promise.all([requestJson(rootUrl), requestJson(billboardUrl), requestJson(offersUrl)]);
  evidence.production = {
    root: { class: classify(root, 'root', rootUrl), status: root.status, error: root.error },
    billboard: { class: classify(billboard, 'billboard', billboardUrl), status: billboard.status, error: billboard.error },
    offers: { class: classify(offers, 'offers', offersUrl), status: offers.status, error: offers.error }
  };

  const offerCandidates = extractOffers(offers.json);
  const billboardOffer = offerCandidates.find(o => String(o.sku || '') === BILLBOARD_SKU || String(o.offer_id || '') === BILLBOARD_OFFER_ID) || null;
  const rawPaymentLink = billboardOffer && (billboardOffer.payment_link || billboardOffer.stripe_payment_link_id);
  const paymentLinkId = normalizePaymentLinkId(rawPaymentLink);
  evidence.billboard_offer = billboardOffer ? {
    found: true,
    sku: billboardOffer.sku || null,
    offer_id: billboardOffer.offer_id || null,
    price_nzd: billboardOffer.price_nzd ?? null,
    payment_link: rawPaymentLink || null,
    payment_link_id: paymentLinkId || null
  } : { found: false };

  const checkout = { status: 'UNVERIFIED_NOT_TESTED', payment_link_id: paymentLinkId || null };
  if (readKey && paymentLinkId) {
    const linkUrl = `https://api.stripe.com/v1/payment_links/${encodeURIComponent(paymentLinkId)}?expand[]=line_items.data.price`;
    const link = await requestJson(linkUrl, { headers: { authorization: `Bearer ${readKey}` } });
    if (!link.ok) checkout.status = 'UNVERIFIED_CONNECTIVITY_FAILURE';
    else if (link.status >= 500) checkout.status = 'UNVERIFIED_SERVER_ERROR';
    else if (link.status >= 400) checkout.status = 'CONTRADICTED_4XX';
    else if (link.json) {
      const item = Array.isArray(link.json.line_items?.data) ? link.json.line_items.data[0] : null;
      const price = item?.price || null;
      checkout.amount_cents = price?.unit_amount ?? null;
      checkout.currency = String(price?.currency || '').toLowerCase() || null;
      checkout.test_mode = link.json.livemode === false;
      checkout.status = !checkout.test_mode && checkout.amount_cents === EXPECTED_AMOUNT_CENTS && checkout.currency === 'nzd' ? 'VERIFIED' : checkout.test_mode ? 'CONTRADICTED_TEST_MODE' : 'CONTRADICTED_PRICE_OR_CURRENCY';
    }
  } else if (!readKey) checkout.status = 'INVALID_MISSING_READONLY_KEY';
  else if (!paymentLinkId) checkout.status = 'CONTRADICTED_PAYMENT_LINK_MISSING';
  evidence.checkout = checkout;

  let attributableSessions = [];
  let attributableCharges = [];
  if (readKey && paymentLinkId) {
    const sessionsUrl = `https://api.stripe.com/v1/checkout/sessions?payment_link=${encodeURIComponent(paymentLinkId)}&limit=100`;
    const sessions = await requestJson(sessionsUrl, { headers: { authorization: `Bearer ${readKey}` } });
    const sessionsClass = classify(sessions, 'Stripe checkout sessions', sessionsUrl);
    if (sessionsClass === 'REACHABLE' && Array.isArray(sessions.json?.data)) {
      attributableSessions = sessions.json.data.filter(s => s.livemode === true && s.payment_status === 'paid' && s.payment_intent);
    }
    const intents = [...new Set(attributableSessions.map(s => s.payment_intent).filter(Boolean))];
    for (const intent of intents) {
      const chargesUrl = `https://api.stripe.com/v1/charges?payment_intent=${encodeURIComponent(intent)}&limit=100`;
      const charges = await requestJson(chargesUrl, { headers: { authorization: `Bearer ${readKey}` } });
      const chargeClass = classify(charges, 'Stripe attributable charges', chargesUrl);
      if (chargeClass === 'REACHABLE' && Array.isArray(charges.json?.data)) {
        attributableCharges.push(...charges.json.data.filter(c => c.livemode === true && c.paid === true && c.refunded !== true));
      }
    }
  } else if (!readKey) invalidReasons.push('STRIPE_READONLY_KEY is missing; payment evidence cannot be observed.');

  const uniqueCharges = [...new Map(attributableCharges.map(c => [c.id, c])).values()];
  const currencies = [...new Set(uniqueCharges.map(c => String(c.currency || '').toLowerCase()))].filter(Boolean);
  const grossMinor = uniqueCharges.reduce((sum, c) => sum + Number(c.amount || 0), 0);
  evidence.payment = {
    method: 'PAYMENT_LINK -> CHECKOUT_SESSIONS -> PAYMENT_INTENT -> CHARGES',
    payment_link_id: paymentLinkId || null,
    paid_checkout_session_count: attributableSessions.length,
    attributable_charge_count: uniqueCharges.length,
    currencies,
    gross_attributable_paid_nzd: currencies.length === 1 && currencies[0] === 'nzd' ? Math.round(grossMinor) / 100 : null,
    status: !readKey ? 'INVALID' : checkout.status !== 'VERIFIED' ? 'UNVERIFIED_CHECKOUT' : uniqueCharges.length ? 'VERIFIED_PAYMENT_EVIDENCE_PRESENT' : 'VERIFIED_ZERO_BILLBOARD_PAYMENTS'
  };

  const truth = await requestJson(BASE_URL + TRUTH_PATH);
  evidence.truth_oracle = truth.ok && truth.status < 400 ? { status: 'VERIFIED_REACHABLE', status_code: truth.status } : { status: 'UNVERIFIED', status_code: truth.status, error: truth.error };

  let prospects = [];
  if (fs.existsSync(PROSPECTS_CSV)) prospects = csvRows(fs.readFileSync(PROSPECTS_CSV, 'utf8'));
  const opportunities = prospects.map((p) => {
    const scored = scoreProspect(p);
    const idSeed = `${p.name || p.business || ''}|${p.website || ''}|${p.email || ''}`;
    const opportunity = {
      opportunity_id: `OPP-${sha256(idSeed).slice(0, 12).toUpperCase()}`,
      offer_sku: BILLBOARD_SKU,
      business: p.name || p.business || '',
      website: p.website || '',
      email: p.email || '',
      fit_score: scored.fit_score,
      intent_score: scored.intent_score,
      engagement_score: scored.engagement_score,
      score: scored.score,
      fit_reasons: scored.fit_reasons,
      intent_reasons: scored.intent_reasons,
      engagement_reasons: scored.engagement_reasons,
      outreach_trigger: scored.outreach_trigger,
      status: p.status || 'READY_FOR_REVIEW',
      send_status: 'NOT_SENT',
      approval_status: 'PENDING',
      approval_required: true,
      payment_link: rawPaymentLink || ''
    };
    const auth = authorizationFor({ ...opportunity, message_body: p.message_body }, RUN_ID);
    opportunity.authorization_id = auth.authorization_id;
    opportunity.authorization_payload_hash = auth.payload_hash;
    opportunity.authorization_snapshot_file = `approvals/${auth.authorization_id}.json`;
    writeJson(path.join(RUN_DIR, opportunity.authorization_snapshot_file), auth);
    return opportunity;
  }).sort((a, b) => b.intent_score - a.intent_score || b.fit_score - a.fit_score || b.engagement_score - a.engagement_score);

  evidence.acquisition = {
    source: fs.existsSync(PROSPECTS_CSV) ? PROSPECTS_CSV : null,
    discovered: prospects.length,
    qualified: opportunities.filter(x => x.fit_score >= 50).length,
    intent_triggered: opportunities.filter(x => x.outreach_trigger).length,
    approval_pending: opportunities.filter(x => x.approval_status === 'PENDING').length,
    opportunities: opportunities.slice(0, 100)
  };

  const mandatoryValid = invalidReasons.length === 0 && evidence.production.root.class === 'REACHABLE' && evidence.production.billboard.class === 'REACHABLE' && evidence.production.offers.class === 'REACHABLE' && evidence.payment.status !== 'INVALID';

  let nextAction;
  if (!mandatoryValid) nextAction = { code: 'REPAIR_MANDATORY_OBSERVATION', approval_required: false, action: 'Repair the mandatory observation layer. No economic verdict is valid from this run.' };
  else if (!billboardOffer) nextAction = { code: 'FIX_BILLBOARD_OFFER', approval_required: false, action: 'Repair the machine-readable Founding Billboard offer.' };
  else if (checkout.status !== 'VERIFIED') nextAction = { code: 'FIX_BILLBOARD_CHECKOUT', approval_required: false, action: 'Repair the NZ$50 live Stripe checkout contract.' };
  else if (evidence.payment.status === 'VERIFIED_ZERO_BILLBOARD_PAYMENTS') nextAction = { code: 'BUYER_ACQUISITION', approval_required: true, action: 'Review the highest-intent Billboard opportunities. Approval must be granted against the frozen authorization record before any outreach worker can act.' };
  else nextAction = { code: 'FULFILMENT_AND_PROOF', approval_required: false, action: 'Reconcile the attributable live payment to fulfilment and generate proof.' };

  const report = {
    schema_version: 'BEC-ECONOMIC-COCKPIT-2.0',
    run_id: RUN_ID,
    generated_at: new Date().toISOString(),
    run_status: invalidReasons.length ? 'INVALID' : 'VALID',
    invalid_reasons: invalidReasons,
    verified_revenue_nzd: evidence.payment.gross_attributable_paid_nzd || 0,
    paid_checkout_session_count: evidence.payment.paid_checkout_session_count,
    attributable_charge_count: evidence.payment.attributable_charge_count,
    production_status: evidence.production.root.class === 'REACHABLE' && evidence.production.billboard.class === 'REACHABLE' && evidence.production.offers.class === 'REACHABLE' ? 'VERIFIED' : 'CONTRADICTED_OR_INVALID',
    billboard_offer: evidence.billboard_offer,
    checkout_status: checkout.status,
    payment_status: evidence.payment.status,
    acquisition: {
      discovered: evidence.acquisition.discovered,
      qualified: evidence.acquisition.qualified,
      intent_triggered: evidence.acquisition.intent_triggered,
      approval_pending: evidence.acquisition.approval_pending
    },
    next_action: nextAction,
    doctrine: {
      business_truth: 'ATTRIBUTABLE_STRIPE_LIVE_PAYMENT_ONLY',
      attribution_chain: 'PAYMENT_LINK -> CHECKOUT_SESSION -> PAYMENT_INTENT -> CHARGE',
      approval: 'IMMUTABLE_COMPLETE_AUTHORIZATION_RECORD',
      secret_mode: 'RESTRICTED_READ_ONLY_KEY_ONLY',
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
  writeJson(path.join(RUN_DIR, '06_acquisition.json'), evidence.acquisition);
  writeJson(path.join(RUN_DIR, '07_report.json'), report);

  const queueHeader = ['opportunity_id','offer_sku','business','website','email','intent_score','fit_score','engagement_score','score','outreach_trigger','authorization_id','authorization_payload_hash','approval_status','send_status'];
  const queueLines = [queueHeader.join(',')];
  for (const o of evidence.acquisition.opportunities) queueLines.push([
    o.opportunity_id,o.offer_sku,o.business,o.website,o.email,o.intent_score,o.fit_score,o.engagement_score,o.score,o.outreach_trigger,
    o.authorization_id,o.authorization_payload_hash,o.approval_status,o.send_status
  ].map(csvEscape).join(','));
  fs.writeFileSync(path.join(RUN_DIR, 'OUTREACH_QUEUE.csv'), queueLines.join('\n') + '\n', 'utf8');
  writeJson(path.join(COCKPIT_ROOT, 'latest.json'), report);

  console.log('');
  console.log('============================================================');
  console.log('DREAMLEDGER ECONOMIC COCKPIT 2.0');
  console.log('============================================================');
  console.log(`State:              ${report.run_status}`);
  console.log(`Billboard revenue:  NZ$${report.verified_revenue_nzd}`);
  console.log(`Billboard payments: ${report.attributable_charge_count}`);
  console.log(`Production:         ${report.production_status}`);
  console.log(`Offer:              ${billboardOffer ? 'DISCOVERED' : 'NOT DISCOVERED'}`);
  console.log(`Checkout:           ${checkout.status}`);
  console.log(`Prospects:          ${evidence.acquisition.discovered}`);
  console.log(`Intent triggers:    ${evidence.acquisition.intent_triggered}`);
  console.log(`Approvals pending:  ${evidence.acquisition.approval_pending}`);
  console.log('');
  console.log(`NEXT ACTION: ${nextAction.action}`);
  console.log(`Approval required: ${nextAction.approval_required}`);
  console.log(`Evidence: ${RUN_DIR}`);
  if (invalidReasons.length) {
    console.log('');
    console.log('NO ECONOMIC VERDICT IS VALID FROM THIS RUN.');
    invalidReasons.forEach(reason => console.log(`- ${reason}`));
    process.exitCode = 2;
  }
}

main().catch(error => {
  console.error('ECONOMIC COCKPIT ERROR');
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
