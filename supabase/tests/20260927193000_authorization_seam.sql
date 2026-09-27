-- Authorization seam regression suite.
-- Branch-only. Execute after 20260927190000_governance_security_hardening.sql
-- and 20260927193000_authorization_seam.sql.
-- These tests are read-only and do not create economic outcomes.

do $$
declare
  r jsonb;
  v text;
  n integer;
begin
  r := public.evaluate_economic_authorization(
    'test-subject',
    'SEND_OUTREACH',
    'test-excluded-resource',
    jsonb_build_object('source','n8n_new_community','category','commercial_communication')
  );
  if r->>'decision' <> 'DENY' or r->>'reason' <> 'SOURCE_EXCLUDED' then
    raise exception 'TEST_FAIL:excluded source was not denied: %',r;
  end if;

  r := public.evaluate_economic_authorization(
    'test-subject',
    'SEND_OUTREACH',
    'test-permitted-resource',
    jsonb_build_object('source','internal_permitted_source','category','commercial_communication')
  );
  if r->>'decision' <> 'NEEDS_APPROVAL' then
    raise exception 'TEST_FAIL:permitted SEND_OUTREACH did not remain approval-gated: %',r;
  end if;

  r := public.evaluate_economic_authorization(
    'test-subject',
    'BUILD_EXECUTION_PACKET',
    'test-planning-resource',
    jsonb_build_object('source','internal','category','PLANNING','max_cost_nzd',0,'reversible',true)
  );
  if r->>'decision' <> 'ALLOW' then
    raise exception 'TEST_FAIL:existing internal planning policy was not preserved: %',r;
  end if;

  select count(*) into n
  from information_schema.routine_privileges
  where routine_schema='public'
    and routine_name='check_source_exclusion'
    and grantee in ('anon','authenticated','PUBLIC');
  if n <> 0 then
    raise exception 'TEST_FAIL:check_source_exclusion remains executable by API/public roles';
  end if;

  select count(*) into n
  from information_schema.routine_privileges
  where routine_schema='public'
    and routine_name='evaluate_economic_authorization'
    and grantee in ('anon','authenticated','PUBLIC');
  if n <> 0 then
    raise exception 'TEST_FAIL:evaluate_economic_authorization remains executable by API/public roles';
  end if;

  foreach v in array array[
    'pre_registrations',
    'evidence_graph_edges',
    'gauntlet_certificates',
    'gauntlet_policy_registry',
    'silo_factory_batches',
    'company_autopilot_state',
    'company_autopilot_runs'
  ]
  loop
    if not exists (
      select 1 from pg_class c
      join pg_namespace ns on ns.oid=c.relnamespace
      where ns.nspname='public' and c.relname=v and c.relrowsecurity
    ) then
      raise exception 'TEST_FAIL:RLS disabled on %',v;
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname='public' and tablename=v and policyname='api_deny_select_'||v
    ) then
      raise exception 'TEST_FAIL:missing explicit API deny SELECT policy on %',v;
    end if;
  end loop;
end $$;

-- Every public view must use querying-role permissions and therefore honor
-- underlying RLS rather than inheriting the view owner's rights.
do $$
declare
  r record;
begin
  for r in
    select c.relname,coalesce(c.reloptions::text,'{}') as reloptions
    from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='v'
  loop
    if position('security_invoker=true' in r.reloptions)=0 then
      raise exception 'TEST_FAIL:public view % is not security_invoker',r.relname;
    end if;
  end loop;
end $$;

-- Static guard: approval consumption must re-consult the PDP before promotion.
do $$
declare
  src text;
begin
  select p.prosrc into src
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='economic_consume_action_authorization';

  if position('evaluate_economic_authorization' in coalesce(src,''))=0 then
    raise exception 'TEST_FAIL:approval consumption does not call canonical PDP';
  end if;

  if position('SOURCE_EXCLUDED' in coalesce(src,''))=0
     or position('PDP_DENIED_AFTER_APPROVAL' in coalesce(src,''))=0 then
    raise exception 'TEST_FAIL:approval consumption lacks fail-closed PDP handling';
  end if;
end $$;

-- Truth-boundary schema guard. A verified economic outcome must have the
-- independent evidence fields available to the Truth Oracle.
do $$
declare
  required text[] := array[
    'external_reference',
    'evidence_ids',
    'truth_status',
    'attribution',
    'metadata'
  ];
  missing text;
begin
  select x
  into missing
  from unnest(required) x
  where not exists (
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='economic_outcomes'
      and column_name=x
  )
  limit 1;

  if missing is not null then
    raise exception 'TEST_FAIL:economic_outcomes missing evidence boundary column %',missing;
  end if;
end $$;
