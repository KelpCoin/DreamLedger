-- Restrict commercial-cell privileged RPCs to server/service-role callers.
-- Applied live to wbwgroygjeyukkspnqiy on 2026-09-25.

revoke execute on function public.marketplace_complete_diagnostic_fulfillment(uuid,text,text,text,text,text,text,bigint,text) from anon, authenticated, public;
revoke execute on function public.marketplace_settle_stripe_payment(uuid,text,text,text,numeric,text,text,integer) from anon, authenticated, public;
revoke execute on function public.marketplace_submit_diagnostic_input(uuid,text,text) from anon, authenticated, public;
