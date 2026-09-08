create or replace function public.guard_economic_candidate_fail_closed()
returns trigger
language plpgsql
as $$
declare
  old_json jsonb := to_jsonb(old);
  new_json jsonb := to_jsonb(new);
  old_gate text;
  old_state text;
  old_action text;
  old_approval text;
  new_state text;
  new_action text;
  new_approval text;
  negative_old boolean;
  positive_new boolean;
begin
  old_gate := upper(coalesce(old_json->>'gate_verdict', old_json->>'verdict', old_json->>'decision', ''));
  old_state := upper(coalesce(old_json->>'status', old_json->>'state', ''));
  old_action := upper(coalesce(old_json->>'action_status', old_json->>'action_state', ''));
  old_approval := upper(coalesce(old_json->>'approval_status', ''));
  new_state := upper(coalesce(new_json->>'status', new_json->>'state', ''));
  new_action := upper(coalesce(new_json->>'action_status', new_json->>'action_state', ''));
  new_approval := upper(coalesce(new_json->>'approval_status', ''));

  negative_old := old_gate in ('FAIL','FAILED','HOLD','REJECTED','QUARANTINE','DEAD','UNSELLABLE')
                  or old_approval in ('FAIL','FAILED','REJECTED','QUARANTINE','DEAD','UNSELLABLE');
  positive_new := new_state in ('OUTREACH','APPROVED','ACTIONABLE','EXECUTED','PUBLISHED')
                  or new_action in ('OUTREACH','APPROVED','ACTIONABLE','EXECUTED','PUBLISHED')
                  or new_approval in ('OUTREACH','APPROVED','ACTIONABLE','EXECUTED','PUBLISHED');

  if tg_op = 'UPDATE' and negative_old and positive_new then
    raise exception 'economic bridge fail-closed: rejected/failed candidate cannot advance to action/approval state';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_economic_candidate_fail_closed() from public;

do $$
begin
  if to_regclass('public.prospecting_candidates') is not null then
    drop trigger if exists trg_guard_economic_candidate_fail_closed on public.prospecting_candidates;
    create trigger trg_guard_economic_candidate_fail_closed
      before insert or update on public.prospecting_candidates
      for each row execute function public.guard_economic_candidate_fail_closed();
  end if;
end;
$$;

comment on function public.guard_economic_candidate_fail_closed() is 'Fail-closed bridge guard v3: an existing negative candidate cannot be transitioned into outreach, approval, actionable, execution, or publication state.';
