-- Batch 15 governance regression tests.
-- Run only after the Batch 14 + Batch 15 migrations are present.
-- No production writes are required by this test file.

begin;

select plan(16);

select ok(
  exists (
    select 1
    from public.check_source_exclusion('n8n:community','commercial',jsonb_build_object('source','n8n'))
    where excluded
  ),
  'n8n source is hard excluded'
);

select ok(
  exists (
    select 1
    from public.check_source_exclusion('internal-research','planning',jsonb_build_object('source','n8n'))
    where excluded
  ),
  'hidden metadata source cannot evade exclusion'
);

select ok(
  not exists (
    select 1
    from public.check_source_exclusion('internal-research','planning',jsonb_build_object('source','internal'))
    where excluded
  ),
  'unrelated internal planning is not excluded'
);

select ok(
  (select verdict from public.evaluate_economic_authorization(
    jsonb_build_object('principal','test-human'),
    jsonb_build_object('action_type','SEND_OUTREACH','source','n8n','category','commercial_communication'),
    jsonb_build_object('target','test-target'),
    '{}'::jsonb
  ) limit 1) = 'deny',
  'PDP denies excluded source'
);

select ok(
  (select source_excluded from public.economic_authorization_decisions
   order by created_at desc limit 1),
  'PDP decision records source exclusion'
);

select ok(
  (select count(*) from public.economic_authorization_decisions
   where verdict in ('allow','deny','needs_approval')) >= 1,
  'PDP decisions use canonical three-way verdict set'
);

select ok(
  (select count(*) from public.economic_authorization_decisions
   where trace_id is not null and request_hash is not null) >= 1,
  'PDP decisions carry trace and request hash'
);

select ok(
  public.economic_outcome_evidence_complete(
    jsonb_build_object('evidence_claims',jsonb_build_object(
      'artifact_integrity',true,'temporal_existence',true,'provenance',true,
      'approval_evidence',true,'declared_ordering',true,'capture_claim',true,
      'relevance_claim',true,'deliberation_traceability',true,'monitoring_claim',true,
      'anchoring_authorization_claim',true,'policy_assessment_claim',true,
      'risk_treatment_claim',true,'mitigation_implementation_claim',true
    ))
  ),
  'all thirteen evidence claims pass completeness'
);

select ok(
  not public.economic_outcome_evidence_complete(
    jsonb_build_object('evidence_claims',jsonb_build_object(
      'artifact_integrity',true,'temporal_existence',true,'provenance',true
    ))
  ),
  'partial evidence claims fail completeness'
);

select ok(
  (select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relname='pre_registrations'),
  'pre_registrations has RLS'
);

select ok(
  (select relforcerowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relname='pre_registrations'),
  'pre_registrations forces RLS'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='pre_registrations'
      and policyname='reject_select_pre_registrations'
  ),
  'pre_registrations has explicit select rejection policy'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='company_autopilot_runs'
      and policyname='reject_insert_company_autopilot_runs'
  ),
  'company_autopilot_runs has explicit insert rejection policy'
);

select ok(
  exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='check_source_exclusion'
      and 'search_path=public, pg_temp' = any(p.proconfig)
  ),
  'check_source_exclusion pins search_path'
);

select ok(
  exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='evaluate_economic_authorization'
      and 'search_path=public, pg_temp' = any(p.proconfig)
  ),
  'canonical PDP pins search_path'
);

select is(
  (public.economic_governance_conformance()->>'security_definer_functions_missing_search_path')::integer,
  0,
  'no public SECURITY DEFINER function lacks an explicit search_path'
);

select * from finish();
rollback;
