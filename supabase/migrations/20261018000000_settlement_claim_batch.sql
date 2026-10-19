-- Settlement claim batch must lease real work atomically and remain service-role only.
-- Keep the existing RETURNS TABLE contract used by settlement workers.
CREATE OR REPLACE FUNCTION public.settlement_claim_batch(
  p_worker_id TEXT,
  p_max INT,
  p_lease_secs INT
)
RETURNS TABLE(
  provider_event_id TEXT,
  payload JSONB,
  attempt_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF nullif(btrim(p_worker_id), '') IS NULL THEN
    RAISE EXCEPTION 'worker id is required' USING errcode = 'P0001';
  END IF;
  IF p_max < 1 OR p_max > 100 THEN
    RAISE EXCEPTION 'invalid batch size' USING errcode = 'P0001';
  END IF;
  IF p_lease_secs < 5 OR p_lease_secs > 3600 THEN
    RAISE EXCEPTION 'invalid lease seconds' USING errcode = 'P0001';
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT p.provider_event_id
    FROM public.processed_webhook_events AS p
    WHERE p.status = 'pending'
       OR (p.status = 'processing' AND p.lease_expires_at <= now())
    ORDER BY p.received_at ASC
    LIMIT p_max
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.processed_webhook_events AS p
  SET status = 'processing',
      lease_owner = p_worker_id,
      lease_expires_at = now() + make_interval(secs => p_lease_secs),
      attempt_count = p.attempt_count + 1,
      started_at = coalesce(p.started_at, now()),
      error = null
  FROM candidates AS c
  WHERE p.provider_event_id = c.provider_event_id
  RETURNING p.provider_event_id, p.payload, p.attempt_count;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.settlement_claim_batch(TEXT, INT, INT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settlement_claim_batch(TEXT, INT, INT)
  TO service_role;
