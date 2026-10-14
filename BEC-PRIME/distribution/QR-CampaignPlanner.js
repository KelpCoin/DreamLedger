'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const QRCode = require('qrcode');

const ROOT = path.join(__dirname, '..');
const REPO_ROOT = path.resolve(ROOT, '..');
const MATRIX_PATH = path.join(ROOT, 'distribution', 'QR-DISTRIBUTION-MATRIX.json');
const CONFIG_PATH = path.join(ROOT, 'distribution', 'config.json');
const PLAN_PATH = path.join(ROOT, 'distribution', 'generated', 'QR-CAMPAIGN-PLAN.json');
const ASSET_DIR = path.join(REPO_ROOT, 'public', 'qr', 'campaigns');
const BASE = 'https://dreamledger.org/go';
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{1,40}$/;

function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function safe(value, fallback, max = 80) {
  const out = String(value == null ? '' : value).trim().replace(/[^A-Za-z0-9._-]/g, '-').slice(0, max);
  return out || fallback;
}
function chooseOffer(item) {
  if (/^PACK-|^REF-/.test(item.id)) return 'MARKETPLACE-DISCOVERY';
  if (/^LGS-|^CLUB-|^EVENT-|^CREATOR-|^COMMUNITY-/.test(item.id)) return 'MTG-COLLECTOR-MARKETPLACE';
  if (/^PARTNER-/.test(item.id)) return 'MTG-COLLECTOR-MARKETPLACE';
  return 'MARKETPLACE-DISCOVERY';
}
function destinationFor(item, offerId) {
  if (/^PACK-/.test(item.id) || /^REF-/.test(item.id)) return 'https://dreamledger.org/go?src=qr-canonical';
  const q = new URLSearchParams({
    utm_source: safe(item.source, 'community'),
    utm_medium: safe(item.medium, 'web'),
    utm_campaign: 'QR-' + item.id,
    placement: item.id,
    experiment_id: 'QR-' + item.id,
    offer_id: offerId
  });
  return BASE + '?' + q.toString();
}
function policyFor(item) {
  if (/^PACK-/.test(item.id)) return {
    status: 'FULFILLMENT_INSERT_READY',
    action: 'generate_insert_for_completed_order',
    may_publish_without_operator: true,
    reason: 'Own customer delivery artifact; no external post is made.'
  };
  if (/^OWNED-/.test(item.id)) return {
    status: 'OWNED_SURFACE_DRAFT',
    action: 'prepare_owned_surface_asset',
    may_publish_without_operator: true,
    reason: 'First-party surface only; no external account or third-party audience is contacted.'
  };
  if (item.approval_required) return {
    status: 'PERMISSION_REQUIRED',
    action: 'prepare_copy_and_asset_only',
    may_publish_without_operator: false,
    reason: 'Requires channel rules and/or explicit permission from the channel, venue, event, creator, or partner owner.'
  };
  return {
    status: 'LOCAL_ASSET_READY',
    action: 'generate_asset_only',
    may_publish_without_operator: true,
    reason: 'Generating an asset does not itself place or publish it.'
  };
}
async function compile() {
  const matrix = readJson(MATRIX_PATH);
  const config = readJson(CONFIG_PATH);
  if (!Array.isArray(matrix.placement_families) || !matrix.placement_families.length) {
    throw new Error('QR distribution matrix has no placement families.');
  }
  if (matrix.canonical?.doorway_id !== config.doorway_id) throw new Error('Canonical doorway ID mismatch.');
  if (!/^https:\/\/dreamledger\.org\/go(?:\?|$)/.test(BASE)) throw new Error('Campaign base must be the canonical first-party HTTPS doorway.');
  fs.mkdirSync(ASSET_DIR, { recursive: true });
  const rows = [];
  for (const item of matrix.placement_families) {
    if (!SAFE_ID.test(String(item.id || ''))) throw new Error('Invalid placement ID: ' + String(item.id));
    const offerId = chooseOffer(item);
    const url = destinationFor(item, offerId);
    const u = new URL(url);
    if (u.protocol !== 'https:' || !['dreamledger.org'].includes(u.hostname)) throw new Error('Non-owned QR target: ' + item.id);
    const assetPath = path.join(ASSET_DIR, item.id + '.svg');
    await QRCode.toFile(assetPath, url, { type: 'svg', errorCorrectionLevel: 'M', margin: 4, width: 1000 });
    const bytes = fs.readFileSync(assetPath);
    const policy = policyFor(item);
    rows.push({
      placement_id: item.id,
      family: item.family,
      placement: item.placement,
      source: item.source,
      medium: item.medium,
      offer_id: offerId,
      tracked_url: url,
      qr_asset: '/qr/campaigns/' + item.id + '.svg',
      qr_sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
      action: policy.action,
      status: policy.status,
      approval_required: !policy.may_publish_without_operator,
      legal_gate: policy.reason,
      external_post_executed: false,
      paid_spend_authorized: false
    });
  }
  const payload = {
    schema: 'dreamledger/qr-campaign-plan/v1',
    generated_at: new Date().toISOString(),
    canonical: { asset_id: config.doorway_id, url: 'https://dreamledger.org/go?src=qr-canonical', image: '/assets/qr-canonical.svg' },
    status: 'PREPARED_NOT_DISTRIBUTED',
    source_matrix: 'BEC-PRIME/distribution/QR-DISTRIBUTION-MATRIX.json',
    placement_count: rows.length,
    legal_policy: {
      auto_publish_only_to_first_party_surfaces: true,
      explicit_permission_required_for_third_party_communities_and_venues: true,
      no_unsolicited_dms: true,
      no_scraped_or_unconsented_email_lists: true,
      no_paid_ads_or_spend: true,
      obey_channel_rules_and_opt_outs: true,
      no_false_scarcity_or_unverified_performance_claims: true,
      qr_scan_is_not_a_buyer_or_revenue_event: true
    },
    campaign_policy: {
      first_party_fulfillment_qr: 'canonical_qr_on_each_buyer_facing_delivery',
      channel_specific_campaigns: 'tracked_qr_variants_for_each_approved_placement',
      external_actions: 'prepare_only_until_channel_permission_is_verified',
      execution: 'no external placement is claimed as executed without a source URL and independent observation'
    },
    placements: rows
  };
  payload.plan_sha256 = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  fs.mkdirSync(path.dirname(PLAN_PATH), { recursive: true });
  fs.writeFileSync(PLAN_PATH, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  return { status: 'PASS_PREPARE_ONLY', plan_path: path.relative(REPO_ROOT, PLAN_PATH), placements: rows.length, generated_qr_assets: rows.length, blocked_external_placements: rows.filter(x => x.approval_required).length, plan_sha256: payload.plan_sha256, external_post_executed: false, paid_spend_authorized: false };
}
if (require.main === module) compile().then(x => console.log(JSON.stringify(x, null, 2))).catch(error => {
  console.error(JSON.stringify({ status: 'FAIL', error: error.message }, null, 2));
  process.exitCode = 1;
});
module.exports = { compile, policyFor, destinationFor, chooseOffer };
