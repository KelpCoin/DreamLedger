-- 20261018_settlement_claim_batch stub to prevent 522
CREATE OR REPLACE FUNCTION public.settlement_claim_batch(p_worker_id TEXT, p_max INT, p_lease_secs INT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $
BEGIN RETURN '[]'::jsonb; END;
$;
GRANT EXECUTE ON FUNCTION public.settlement_claim_batch(TEXT,INT,INT) TO anon, authenticated, service_role;
