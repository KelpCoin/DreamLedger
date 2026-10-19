-- Run after 20261019_harden_dreammeez_item_ownership.sql in a non-production
-- database or approved migration window. This verifies the database-level gate.
do $$
begin
  if not exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'commerce_item_ownership'
      and c.relrowsecurity
  ) then
    raise exception 'FAIL: RLS is not enabled on commerce_item_ownership';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'commerce_item_ownership'
      and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
  ) then
    raise exception 'FAIL: a row-level mutation policy remains on commerce_item_ownership';
  end if;

  if has_table_privilege('anon', 'public.commerce_item_ownership', 'INSERT')
     or has_table_privilege('authenticated', 'public.commerce_item_ownership', 'INSERT')
     or has_table_privilege('anon', 'public.commerce_item_ownership', 'UPDATE')
     or has_table_privilege('authenticated', 'public.commerce_item_ownership', 'UPDATE')
     or has_table_privilege('anon', 'public.commerce_item_ownership', 'DELETE')
     or has_table_privilege('authenticated', 'public.commerce_item_ownership', 'DELETE') then
    raise exception 'FAIL: a browser-facing role retains direct write privileges';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'commerce_item_ownership'
      and policyname = 'commerce_item_ownership_self_read'
      and cmd = 'SELECT'
  ) then
    raise exception 'FAIL: expected self-read policy is missing';
  end if;
end
$$;

select 'PASS: ownership table is RLS-protected, client mutation is denied, and self-read policy exists.'
  as result;
