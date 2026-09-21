alter table public.economic_transitions add column if not exists idempotency_key text;
update public.economic_transitions set idempotency_key = 'dl-transition-' || transition_id where idempotency_key is null;
alter table public.economic_transitions alter column idempotency_key set not null;
create unique index if not exists economic_transitions_idempotency_key_uq on public.economic_transitions (idempotency_key);
create or replace function public.block_economic_transition_mutation()
returns trigger language plpgsql security invoker as $$
begin
  raise exception 'economic_transitions is append-only';
end;
$$;
drop trigger if exists economic_transitions_no_update_delete on public.economic_transitions;
create trigger economic_transitions_no_update_delete
before update or delete on public.economic_transitions
for each row execute function public.block_economic_transition_mutation();
alter table public.economic_transitions enable row level security;
drop policy if exists service_role_full_access on public.economic_transitions;
drop policy if exists authenticated_read_own on public.economic_transitions;
drop policy if exists transitions_authenticated_read on public.economic_transitions;
drop policy if exists transitions_service_insert on public.economic_transitions;
create policy transitions_authenticated_read on public.economic_transitions
for select to authenticated using (
  offer_id in (select id::text from public.marketplace_listings where seller_id = auth.uid())
);
create policy transitions_service_insert on public.economic_transitions
for insert to service_role with check (true);
revoke update, delete on public.economic_transitions from authenticated;
revoke update, delete on public.economic_transitions from service_role;
grant select on public.economic_transitions to authenticated;
grant insert on public.economic_transitions to service_role;
