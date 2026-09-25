-- 2026-09-22 control-plane hardening: idempotent transitions + fail-closed kill query.
create unique index if not exists economic_transitions_idempotency_key_uidx
  on public.economic_transitions(idempotency_key);

create or replace function public.is_killed(p_scope text,p_target_id text)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists(
    select 1
    from public.kill_switch_events
    where scope=p_scope
      and target_id=p_target_id
      and reversed_at is null
  );
$$;

revoke all on function public.is_killed(text,text) from public;
grant execute on function public.is_killed(text,text) to service_role;
