create table if not exists economic_transitions (
  transition_id   text primary key,
  offer_id        text not null,
  from_state      text not null,
  to_state        text not null,
  outcome         text not null check (outcome in (
                    'REJECTED','AWAITING_AUTHORIZATION','APPROVED',
                    'EXECUTING','PUBLISHED','VERIFIED','FAILED')),
  reason          jsonb,
  authority_token text,
  checkpoint_id   text,
  created_at      timestamptz not null default now(),
  executed_at     timestamptz,
  verified_at     timestamptz,
  idempotency_key text not null
);

create unique index if not exists economic_transitions_idempotency_key_uq
  on economic_transitions (idempotency_key);

create index if not exists economic_transitions_offer_created_idx
  on economic_transitions (offer_id, created_at desc);

create index if not exists economic_transitions_outcome_active_idx
  on economic_transitions (outcome)
  where outcome in ('EXECUTING','PUBLISHED');

alter table economic_transitions enable row level security;

create or replace function block_economic_transition_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'economic_transitions is append-only';
end;
$$;

drop trigger if exists no_update_economic_transitions on economic_transitions;
create trigger no_update_economic_transitions
before update or delete on economic_transitions
for each row execute function block_economic_transition_mutation();

drop policy if exists service_role_full_access on economic_transitions;
drop policy if exists authenticated_read_own on economic_transitions;
drop policy if exists transitions_authenticated_read on economic_transitions;
drop policy if exists transitions_service_insert on economic_transitions;

create policy transitions_authenticated_read on economic_transitions
  for select to authenticated using (true);

create policy transitions_service_insert on economic_transitions
  for insert to service_role with check (true);

alter table offers
  alter column version set default 1;

update offers
set version = 1
where version is null;
