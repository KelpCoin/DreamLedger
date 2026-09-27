-- Governance hardening regression tests.
-- Run only after 20260927190000_governance_security_hardening.sql.
-- Read-only assertions except function catalog inspection.

do $$
declare
  r record;
  t text;
begin
  select * into r
  from public.check_source_exclusion('n8n_community:316737','planning','{}'::jsonb)
  limit 1;
  if not coalesce(r.excluded,false) then
    raise exception 'TEST_FAIL:n8n source was not excluded';
  end if;

  select * into r
  from public.check_source_exclusion('unknown','planning','{"source":"n8n"}'::jsonb)
  limit 1;
  if not coalesce(r.excluded,false) then
    raise exception 'TEST_FAIL:metadata n8n source was not excluded';
  end if;

  select * into r
  from public.check_source_exclusion('internal','planning','{}'::jsonb)
  limit 1;
  if coalesce(r.excluded,false) then
    raise exception 'TEST_FAIL:unrelated internal planning was excluded';
  end if;

  foreach t in array array[
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
      select 1
      from pg_class c
      join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public'
        and c.relname=t
        and c.relrowsecurity
    ) then
      raise exception 'TEST_FAIL:RLS disabled on %',t;
    end if;

    if not exists (
      select 1
      from information_schema.role_table_grants g
      where g.table_schema='public'
        and g.table_name=t
        and g.grantee='anon'
    ) then
      null;
    end if;
  end loop;
end $$;

-- Static guard checks. The function definitions must retain the exclusion
-- lookup and dispatch must retain the second boundary.
do $$
declare
  v_source text;
  v_dispatch text;
begin
  select p.prosrc into v_source
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='create_economic_execution_packet';

  if position('check_source_exclusion' in coalesce(v_source,'')) = 0 then
    raise exception 'TEST_FAIL:packet creation does not call exclusion gate';
  end if;

  select p.prosrc into v_dispatch
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='dispatch_authorized_economic_packets';

  if position('check_source_exclusion' in coalesce(v_dispatch,'')) = 0 then
    raise exception 'TEST_FAIL:dispatch does not call exclusion gate';
  end if;
end $$;
