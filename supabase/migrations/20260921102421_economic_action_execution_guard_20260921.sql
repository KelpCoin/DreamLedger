begin;

-- The action execution guard is part of the canonical guard function introduced
-- in the preceding migration. Keep this migration as the historical reconciliation
-- point for the production hardening version and make its grants explicit.
revoke all on function public.enforce_economic_truth_and_action_guards() from public,anon,authenticated;
grant execute on function public.enforce_economic_truth_and_action_guards() to service_role;

commit;
