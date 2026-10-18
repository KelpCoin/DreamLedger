'use strict';

/**
 * Elohim → Gauntlet scorecard emitter
 *
 * Elohim may define acceptance criteria and emit scorecards.
 * Gauntlet adversarially judges every Elohim output before promotion.
 * PASS does not equal verified revenue — external settlement required.
 *
 * Sentinels / trends feed signals here so the gauntlet has fresh criteria
 * for new surfaces (not a static 10-check list forever).
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'RUN-PROOFS', 'GAUNTLET', 'SCORECARDS');

const BASE_CHECKS = Object.freeze([
  'signal_integrity',
  'commercial_identity',
  'attribution_integrity',
  'experiment_identity',
  'human_gate_integrity',
  'payment_reality',
  'fulfillment_reality',
  'evidence_completeness',
  'truth_oracle_consistency',
  'replication_permission'
]);

const SURFACE_EXTRA_CHECKS = Object.freeze({
  mtg: ['inventory_honesty', 'card_grid_marketing', 'singles_first_policy'],
  avatar: ['cosmetic_try_on', 'dual_surface_web_phinhaven', 'impulse_price_band'],
  digital_products: ['schema_validation', 'stripe_link_present', 'silo_allowlist'],
  crypto: ['no_fake_apy', 'risk_disclosure'],
  media_music: ['license_clearance'],
  phinhaven: ['floor1_scope_lock', 'avatar_loadout_adapter', 'no_p2w_combat'],
  storefront: ['checkout_route_live', 'no_revenue_claim_without_receipt'],
  figure_eight: ['compounding_artifact', 'receipt_hashes', 'reuse_demonstrated']
});

function stableId(parts) {
  return crypto.createHash('sha256').update(JSON.stringify(parts)).digest('hex').slice(0, 16).toUpperCase();
}

/**
 * @param {object} input
 * @param {string} input.surface - e.g. mtg | avatar | storefront | figure_eight
 * @param {string} input.subject - what is being judged
 * @param {object} [input.signal] - sentinel/trend signal
 * @param {string[]} [input.extra_checks] - trend-driven checks Elohim adds
 * @param {object} [input.evidence_refs] - links/paths only; not fabricated results
 * @param {string} [input.proposed_verdict] - Elohim hypothesis only; gauntlet may override
 */
function emitScorecard(input = {}) {
  const surface = String(input.surface || 'storefront').toLowerCase();
  const subject = String(input.subject || 'unspecified');
  const signal = input.signal || {};
  const extra = []
    .concat(SURFACE_EXTRA_CHECKS[surface] || [])
    .concat(Array.isArray(input.extra_checks) ? input.extra_checks : []);

  const checks = BASE_CHECKS.map((id) => ({
    id,
    required: true,
    status: 'PENDING',
    note: null
  })).concat(
    [...new Set(extra)].map((id) => ({
      id,
      required: true,
      status: 'PENDING',
      note: signal.rationale || 'Trend/sentinel-derived check',
      source_signal: signal.id || signal.trend_id || null
    }))
  );

  const id = 'SCORECARD-' + stableId([surface, subject, signal.id || null, checks.map((c) => c.id)]);

  const scorecard = {
    schema: 'dreamledger/gauntlet-scorecard/v2',
    id,
    emitted_by: 'ELOHIM',
    emitted_at: new Date().toISOString(),
    surface,
    subject,
    signal: {
      id: signal.id || null,
      trend_id: signal.trend_id || null,
      source: signal.source || 'sentinel_or_manual',
      summary: signal.summary || null
    },
    checks,
    elohim_hypothesis: {
      proposed_verdict: input.proposed_verdict || 'HOLD',
      may_not: [
        'declare_verified_revenue',
        'declare_winner_without_external_evidence',
        'authorize_external_action'
      ]
    },
    gauntlet: {
      role: 'adversarial_judge',
      verdicts: ['PASS', 'HOLD', 'KILL', 'CONTRADICTED', 'PASS_SHELL_ONLY'],
      promotion_rule:
        'PASS alone does not create economic truth; settled payment + fulfillment + independent evidence required for VERIFIED.'
    },
    evidence_refs: input.evidence_refs || {},
    figure_eight: surface === 'figure_eight'
      ? {
          requires: ['usable_artifact', 'compounding_component', 'receipt_with_hashes'],
          status: 'PENDING'
        }
      : null
  };

  return scorecard;
}

function writeScorecard(scorecard, opts = {}) {
  const dir = opts.outDir || OUT_DIR;
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${scorecard.id}.json`);
  fs.writeFileSync(file, JSON.stringify(scorecard, null, 2) + '\n', 'utf8');
  return file;
}

/** Sentinel/trend → scorecard batch for surface coverage */
function reinforceGauntletFromSignals(signals = [], defaults = {}) {
  const out = [];
  for (const signal of signals) {
    const card = emitScorecard({
      surface: signal.surface || defaults.surface || 'storefront',
      subject: signal.subject || signal.summary || 'trend_subject',
      signal,
      extra_checks: signal.extra_checks || [],
      evidence_refs: signal.evidence_refs || {},
      proposed_verdict: 'HOLD'
    });
    if (defaults.write !== false) {
      card._path = writeScorecard(card);
    }
    out.push(card);
  }
  return out;
}

module.exports = {
  BASE_CHECKS,
  SURFACE_EXTRA_CHECKS,
  emitScorecard,
  writeScorecard,
  reinforceGauntletFromSignals
};

if (require.main === module) {
  const demo = emitScorecard({
    surface: 'storefront',
    subject: 'economic_validation_first_dollar',
    signal: {
      id: 'SENTINEL-DEMO-PAY',
      source: 'manual',
      summary: 'Need settled Stripe receipt before VERIFIED claims'
    },
    extra_checks: ['receipt_fossil_present'],
    proposed_verdict: 'HOLD'
  });
  const file = writeScorecard(demo);
  console.log(JSON.stringify({ wrote: file, id: demo.id, checks: demo.checks.length }, null, 2));
}
