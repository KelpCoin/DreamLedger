create table if not exists public.transition_checkpoints (
  checkpoint_id text primary key,
  transition_id text not null references public.economic_transitions(transition_id),
  snapshot jsonb not null,
  state_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.transition_idempotency (
  idempotency_key text primary key,
  transition_id text not null references public.economic_transitions(transition_id),
  first_seen_at timestamptz not null default now(),
  outcome text not null,
  response jsonb
);

create index if not exists transition_checkpoints_transition_idx on public.transition_checkpoints (transition_id, created_at desc);

alter table public.transition_checkpoints enable row level security;
alter table public.transition_idempotency enable row level security;

do $$ begin
 if not exists (select 1 from pg_policies where schemaname='public' and tablename='transition_checkpoints' and policyname='service_role_full_access') then
   create policy "service_role_full_access" on public.transition_checkpoints for all to service_role using (true) with check (true);
 end if;
 if not exists (select 1 from pg_policies where schemaname='public' and tablename='transition_idempotency' and policyname='service_role_full_access') then
   create policy "service_role_full_access" on public.transition_idempotency for all to service_role using (true) with check (true);
 end if;
end $$;

create or replace function public.record_transition_checkpoint(
  p_checkpoint_id text,
  p_transition_id text,
  p_snapshot jsonb,
  p_state_hash text
) returns public.transition_checkpoints
language plpgsql
security definer
set search_path = public
as $$
declare v_row public.transition_checkpoints;
begin
  if p_checkpoint_id is null or p_transition_id is null or p_snapshot is null or p_state_hash is null then
    raise exception 'checkpoint fields are required';
  end if;
  insert into public.transition_checkpoints(checkpoint_id, transition_id, snapshot, state_hash)
  values(p_checkpoint_id, p_transition_id, p_snapshot, p_state_hash)
  on conflict (checkpoint_id) do update
    set snapshot = excluded.snapshot,
        state_hash = excluded.state_hash;
  select * into v_row from public.transition_checkpoints where checkpoint_id = p_checkpoint_id;
  return v_row;
end $$;

create or replace function public.claim_transition_idempotency(
  p_idempotency_key text,
  p_transition_id text,
  p_outcome text,
  p_response jsonb default null
) returns table(is_new boolean, prior_outcome text, prior_response jsonb)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_idempotency_key is null or p_transition_id is null or p_outcome is null then
    raise exception 'idempotency fields are required';
  end if;
  begin
    insert into public.transition_idempotency(idempotency_key, transition_id, outcome, response)
    values(p_idempotency_key, p_transition_id, p_outcome, p_response);
    return query select true, null::text, null::jsonb;
  exception when unique_violation then
    return query
      select false, t.outcome, t.response
      from public.transition_idempotency t
      where t.idempotency_key = p_idempotency_key;
  end;
end $$;
