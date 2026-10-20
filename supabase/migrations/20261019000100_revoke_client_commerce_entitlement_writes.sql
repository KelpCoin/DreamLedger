-- Close the client-side entitlement self-grant path.
-- Paid entitlements are server-written after verified settlement and fulfillment.
-- This migration must be applied and read back against production before release.
begin;

do $$
declare
  p record;
begin
  if to_regclass('public.commerce_item_ownership') is null then
    raise exception 'commerce_item_ownership is missing; refusing entitlement-policy remediation';
  end if;

  alter table public.commerce_item_ownership enable row level security;

  -- Rebuild the full policy set from a known-safe baseline. Keeping an existing
  -- SELECT policy merely by name would not prove that its USING expression is safe.
  for p in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'commerce_item_ownership'
  loop
    execute format('drop policy if exists %I on public.commerce_item_ownership', p.policyname);
  end loop;
end
$$;

-- Remove table-level client privileges first, then allow only authenticated self-read.
revoke all privileges on table public.commerce_item_ownership from anon, authenticated;
grant select on table public.commerce_item_ownership to authenticated;

create policy commerce_item_ownership_self_read
  on public.commerce_item_ownership
  for select to authenticated
  using ((select auth.uid()) = user_id);

comment on table public.commerce_item_ownership is
  'Paid entitlements are backend-written only after verified settlement and fulfillment; client roles have self-read only.';

commit;
