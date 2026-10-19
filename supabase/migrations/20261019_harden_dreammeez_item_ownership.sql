-- Paid item ownership is server-issued. Authenticated clients may read only
-- their own ownership rows, but must never grant themselves entitlements.
begin;

alter table public.commerce_item_ownership enable row level security;

-- Remove every mutation policy, including any broader policy added later under a
-- different name. Trusted server-side roles bypass RLS; client roles do not.
do $$
declare
  p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'commerce_item_ownership'
      and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
  loop
    execute format('drop policy if exists %I on public.commerce_item_ownership', p.policyname);
  end loop;
end
$$;

-- RLS is not the only boundary. Remove direct table-write grants from all
-- browser-facing roles as defence in depth. Service-role fulfillment remains
-- the controlled grant path and must still enforce paid, idempotent events.
revoke insert, update, delete
  on table public.commerce_item_ownership
  from public, anon, authenticated;

comment on table public.commerce_item_ownership is
  'Server-issued entitlements only. Browser roles are read-only; grant through a trusted, reconciled fulfillment path.';

commit;
