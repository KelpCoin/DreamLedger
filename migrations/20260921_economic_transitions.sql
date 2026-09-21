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
  verified_at     timestamptz
);

create index on economic_transitions (offer_id, created_at desc);
create index on economic_transitions (outcome) where outcome in ('EXECUTING','PUBLISHED');

alter table economic_transitions enable row level security;

create policy "service_role_full_access" on economic_transitions
  for all to service_role using (true) with check (true);

create policy "authenticated_read_own" on economic_transitions
  for select to authenticated
  using (offer_id in (select id::text from marketplace_listings where owner_user_id = auth.uid()));
