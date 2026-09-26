-- Reconcile the six true silos from the 2026-09-26 Agent Bridge handoff.
-- Idempotent. Does not create new revenue, products, or public access.
-- Also records the current n8n exclusion at the opportunity layer so detected
-- n8n community items cannot enter an execution lane.

insert into public.economic_silo_loops
  (silo_id, stage, loop_state, attempt_count, external_exposure_count,
   checkout_count, settled_payment_count, fulfilled_count, verified_outcome_count,
   evidence, provenance)
values
  ('money-billboard-tile','APPROVAL_READY','ACTIVE',0,0,0,0,0,0,
   '{"verified_external_revenue_nzd":0,"distribution_status":"pending_human","price_nzd":50}'::jsonb,
   '{"source":"ops/silos/true_silos_registry.json","source_commit":"b6053018b0906a2a7576ce1472650a47efbcefec"}'::jsonb),
  ('money-cmd-diagnostic','APPROVAL_READY','ACTIVE',0,0,0,0,0,0,
   '{"verified_external_revenue_nzd":0,"distribution_status":"pending_human","price_nzd":29}'::jsonb,
   '{"source":"ops/silos/true_silos_registry.json","source_commit":"b6053018b0906a2a7576ce1472650a47efbcefec"}'::jsonb),
  ('money-discord-kit','APPROVAL_READY','ACTIVE',0,0,0,0,0,0,
   '{"verified_external_revenue_nzd":0,"distribution_status":"pending_human","price_nzd":79}'::jsonb,
   '{"source":"ops/silos/true_silos_registry.json","source_commit":"b6053018b0906a2a7576ce1472650a47efbcefec"}'::jsonb),
  ('care-account','DORMANT','ACTIVE',0,0,0,0,0,0,
   '{"public_safe":true,"price_nzd":0}'::jsonb,
   '{"source":"ops/silos/true_silos_registry.json","source_commit":"b6053018b0906a2a7576ce1472650a47efbcefec"}'::jsonb),
  ('care-phin-haven','DORMANT','ACTIVE',0,0,0,0,0,0,
   '{"public_safe":true,"price_nzd":0}'::jsonb,
   '{"source":"ops/silos/true_silos_registry.json","source_commit":"b6053018b0906a2a7576ce1472650a47efbcefec"}'::jsonb),
  ('care-billboard-view','DORMANT','ACTIVE',0,0,0,0,0,0,
   '{"public_safe":true,"price_nzd":0}'::jsonb,
   '{"source":"ops/silos/true_silos_registry.json","source_commit":"b6053018b0906a2a7576ce1472650a47efbcefec"}'::jsonb)
on conflict (silo_id) do nothing;

update public.cube_opportunities
set status = 'DID_NOT_CONVERT',
    authority_lane = 'RED',
    qualification_reason = 'Source excluded by current CUBE operating policy: n8n community discovery is not an approved acquisition source.',
    outcome = coalesce(outcome, '{}'::jsonb)
      || jsonb_build_object(
        'exclusion','n8n_community',
        'policy_action','DID_NOT_CONVERT'
      )
where source = 'n8n_community'
  and status = 'DETECTED';
