'use strict';

const fs = require('fs');
const path = require('path');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');

async function query(table, params='select=*') {
  const response = await fetch(url + '/rest/v1/' + table + '?' + params, {
    headers: { apikey: key, Authorization: 'Bearer ' + key }
  });
  if (!response.ok) throw new Error(table + ' query failed: ' + response.status + ' ' + await response.text());
  return response.json();
}

(async () => {
  const [truthRows, controlRows, cells, actions, actuators] = await Promise.all([
    query('economic_business_truth'),
    query('economic_control_report'),
    query('commerce_cells', 'select=cell_id,sku,name,canonical_state,approval_required,verified_checkout,verified_fulfillment,verified_webhook,evidence_ref&order=updated_at.desc'),
    query('economic_actions', 'select=action_id,cell_id,action_type,authorization_state,execution_state,expires_at,actuator_id,idempotency_key&order=created_at.desc'),
    query('economic_actuators', 'select=actuator_id,status,action_type,external_system')
  ]);

  const truth = truthRows[0] || {};
  const control = controlRows[0] || {};
  const blockers = [];
  if (Number(truth.verified_revenue_nzd || 0) <= 0) blockers.push('NO_VERIFIED_EXTERNAL_REVENUE');
  if (Number(control.pending_actions || 0) > 0) blockers.push('AUTHORITY_ACTIONS_PENDING');
  if (Number(control.actuators_unavailable || 0) > 0) blockers.push('EXTERNAL_ACTUATOR_UNAVAILABLE');
  if (Number(control.active_cell_count || 0) === 0 && Number(control.ready_cells || 0) === 0) blockers.push('NO_READY_OR_ACTIVE_CELL');

  const ready = cells.filter(c => c.canonical_state === 'READY');
  const availableActuators = actuators.filter(a => a.status === 'AVAILABLE');
  const nextExternalTransition = ready.length
    ? 'ACTION_PREPARED -> AUTHORITY_REQUIRED'
    : Number(control.active_cell_count || 0) > 0
      ? 'ACTIVE -> ACTION_PREPARED'
      : 'NONE';

  const report = {
    schema: 'dreamledger.economic-readiness.v1',
    generated_at: new Date().toISOString(),
    current_economic_truth: {
      verified_revenue_nzd: Number(truth.verified_revenue_nzd || 0),
      verified_external_payments: Number(truth.verified_payment_count || 0),
      verified_outcomes: Number(truth.verified_outcome_count || 0),
      independent_buyers: Number(control.independent_buyers || 0),
      current_state: control.current_state || 'UNVERIFIED'
    },
    active_cells: cells.filter(c => ['ACTIVE','READY'].includes(c.canonical_state)).map(c => ({
      cell_id: c.cell_id, sku: c.sku, name: c.name, state: c.canonical_state
    })),
    next_external_transition: nextExternalTransition,
    blockers,
    actuator_status: {
      available: availableActuators,
      unavailable_count: Number(control.actuators_unavailable || 0)
    },
    human_authority_requirements: actions
      .filter(a => a.execution_state === 'AUTHORITY_REQUIRED' || a.authorization_state === 'AUTHORITY_REQUIRED')
      .slice(0, 20)
      .map(a => ({ action_id: a.action_id, action_type: a.action_type, expires_at: a.expires_at, idempotency_key: a.idempotency_key })),
    control_snapshot: control,
    generated_by: 'BEC-PRIME/scripts/Generate-EconomicReadiness.js'
  };

  const out = path.join(process.cwd(), 'artifacts', 'economic_readiness.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify(report, null, 2));
})().catch(err => {
  console.error(err.stack || err);
  process.exit(1);
});
