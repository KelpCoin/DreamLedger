'use strict';

const crypto = require('crypto');

const sha = value => crypto.createHash('sha256').update(value, 'utf8').digest('hex');

const FACTORY_BATCH_MIN = 5;
const FACTORY_BATCH_MAX = 10;

const DEFAULT_LANES = [
  'PROBLEM_FIRST',
  'AUDIT_FIRST',
  'SAVINGS_FIRST',
  'RISK_FIRST',
  'OUTCOME_FIRST'
];

function buildFactoryTemplates(adapters = []) {
  const source = Array.isArray(adapters) ? adapters : [];
  const families = source.length ? source : [{
    slug: 'economic-reconciliation',
    name: 'Economic Reconciliation Factory',
    fulfillment: 'SUPPLIER_QUOTE_COMPARISON'
  }];

  return families.map((adapter, index) => {
    const slug = String(adapter.slug || adapter.id || 'factory-' + (index + 1));
    const mechanismFamily = String(adapter.fulfillment || 'ECONOMIC_ANALYSIS').toUpperCase();
    return {
      factory_id: 'FACTORY-' + slug.toUpperCase().replace(/[^A-Z0-9]+/g, '-'),
      mechanism_family: mechanismFamily,
      substrate_source: 'EVERGREEN_SILO_FACTORY',
      capability_adapter: slug,
      name: adapter.name || slug,
      variant_batch_size: FACTORY_BATCH_MIN,
      max_variant_batch_size: FACTORY_BATCH_MAX,
      lanes: DEFAULT_LANES,
      telemetry_schema: [
        'exposures',
        'qualified_clicks',
        'checkout_starts',
        'settled_payments',
        'fulfilled_orders',
        'verified_outcomes',
        'acquisition_cost_nzd',
        'fulfillment_cost_nzd',
        'human_touches',
        'time_to_fulfill',
        'margin_nzd'
      ],
      authority: 'ALLOCATION_ONLY',
      public_launch: 'APPROVAL_REQUIRED',
      promotion_gate: 'VERIFIED_EXTERNAL_OUTCOME_REQUIRED',
      kill_gate: 'NO_QUALIFIED_DEMAND_OR_NO_FULFILLMENT_PROOF',
      replication_gate: 'FORBIDDEN_UNTIL_INDEPENDENT_VERIFIED_OUTCOME',
      truth_authority: 'TRUTH_ORACLE',
      source_checkout_url: adapter.checkout_url || null
    };
  });
}

function buildFactoryInstances(templates = [], seed = {}) {
  return templates.map((template, templateIndex) => {
    const seedId = seed.opportunity_id || seed.candidate_id || 'UNBOUND-SEED';
    const instances = [];
    for (let i = 0; i < template.variant_batch_size; i += 1) {
      const material = JSON.stringify({
        factory_id: template.factory_id,
        seed_id: seedId,
        variant: i + 1
      });
      const identity = sha(material).slice(0, 20).toUpperCase();
      instances.push({
        factory_instance_id: 'FI-' + identity,
        factory_id: template.factory_id,
        mechanism_family: template.mechanism_family,
        capability_adapter: template.capability_adapter,
        seed_opportunity_id: seedId,
        variant_number: i + 1,
        state: 'PROBING',
        authority: template.authority,
        public_launch: template.public_launch,
        telemetry: Object.fromEntries(template.telemetry_schema.map(k => [k, k === 'time_to_fulfill' || k === 'margin_nzd' ? null : 0])),
        promotion_gate: template.promotion_gate,
        kill_gate: template.kill_gate,
        replication_gate: template.replication_gate,
        truth_status: 'UNVERIFIED',
        external_action: 'BLOCKED',
        replication_permission: false,
        registry_authority: 'SUPABASE_CUBE_SILO_REGISTRY'
      });
    }
    return {
      factory_id: template.factory_id,
      template_index: templateIndex,
      mechanism_family: template.mechanism_family,
      instance_count: instances.length,
      instances
    };
  });
}

function buildFactoryFactory(adapters = [], seed = {}) {
  const templates = buildFactoryTemplates(adapters);
  const instanceGroups = buildFactoryInstances(templates, seed);
  return {
    schema_version: 'DREAMLEDGER/777/FACTORY-FACTORY/v1',
    status: 'READY_FOR_INTERNAL_CUBE_GAUNTLET',
    authority: 'ALLOCATION_ONLY',
    truth_authority: 'TRUTH_ORACLE',
    source_substrate: 'EVERGREEN_SILO_FACTORY',
    template_count: templates.length,
    factory_instance_count: instanceGroups.reduce((n, x) => n + x.instance_count, 0),
    batch_rule: 'EACH_FACTORY_INSTANCE_BATCH_IS_5_TO_10',
    templates,
    instance_groups: instanceGroups,
    external_action: 'BLOCKED',
    public_launch: 'APPROVAL_REQUIRED',
    replication: 'FORBIDDEN_UNTIL_INDEPENDENT_VERIFIED_OUTCOME',
    truth: {
      verified_external_revenue_nzd: 0,
      settled_external_payments: 0,
      independent_external_buyers: 0,
      verified_economic_outcomes: 0,
      status: 'UNVERIFIED'
    }
  };
}

module.exports = { buildFactoryTemplates, buildFactoryInstances, buildFactoryFactory };
