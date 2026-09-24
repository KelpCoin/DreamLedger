-- Protect the external-admission control plane.
revoke all on table public.economic_action_authorizations from anon, authenticated;
alter table public.economic_action_authorizations enable row level security;
drop policy if exists economic_action_authorizations_deny_anon on public.economic_action_authorizations;
drop policy if exists economic_action_authorizations_deny_authenticated on public.economic_action_authorizations;
create policy economic_action_authorizations_deny_anon on public.economic_action_authorizations for all to anon using (false) with check (false);
create policy economic_action_authorizations_deny_authenticated on public.economic_action_authorizations for all to authenticated using (false) with check (false);
