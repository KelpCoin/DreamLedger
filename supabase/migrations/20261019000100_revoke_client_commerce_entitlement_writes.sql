-- Close the client-side entitlement self-grant path.
-- The service-role backend remains the only writer; clients may read their own rows.
begin;

do $$
declare
  p record;
begin
  if to_regclass('public.commerce_item_ownership') is null then
    raise exception 'commerce_item_ownership is missing; refusing entitlement-policy remediation';
  end if;

  alter table public.commerce_item_ownership enable row level security;

  -- Remove every policy that could permit authenticated/anonymous or broad-role writes.
  -- Trusted service-role fulfillment does not need a client RLS write policy.
  for p in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'commerce_item_ownership'
      and upper(cmd) in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
  loop
    execute format('drop policy if exists %I on public.commerce_item_ownership', p.policyname);
  end loop;
end
$$;

-- RLS is not the only guard. Remove table-level client write grants as a second boundary.
revoke insert, update, delete, truncate, references, trigger
  on table public.commerce_item_ownership from anon, authenticated;

-- Keep only the self-read policy. Re-create safely if it is missing.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'commerce_item_ownership'
      and policyname = 'commerce_item_ownership_self_read'
      and upper(cmd) = 'SELECT'
  ) then
    create policy commerce_item_ownership_self_read
      on public.commerce_item_ownership
      for select to authenticated
      using ((select auth.uid()) = user_id);
  end if;
end
$$;

comment on table public.commerce_item_ownership is
  'Paid entitlements are backend-written only after verified settlement and fulfillment; clients have self-read only.';

commit;
