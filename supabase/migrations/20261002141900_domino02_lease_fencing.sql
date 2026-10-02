-- DOMINO 02: atomic lease fencing for the existing economic_actions work substrate.
-- Production-safe repository migration only. No production database is modified by this commit.
--
-- Reconnaissance identified no dedicated task queue. The smallest existing work item
-- substrate is public.economic_actions. This migration adds only the three required
-- lease/fencing fields and two PostgreSQL RPCs.

ALTER TABLE public.economic_actions
  ADD COLUMN IF NOT EXISTS claimed_by text,
  ADD COLUMN IF NOT EXISTS lease_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS fencing_token bigint NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='economic_actions' AND column_name='id'
  ) THEN
    RAISE EXCEPTION 'DOMINO02_BLOCKED: public.economic_actions.id is required';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='economic_actions' AND column_name='result'
  ) THEN
    RAISE EXCEPTION 'DOMINO02_BLOCKED: public.economic_actions.result is required as the existing authoritative result field';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.domino02_claim_task(
  p_task_id text,
  p_worker text,
  p_lease_seconds integer DEFAULT 60
)
RETURNS TABLE (
  claimed boolean,
  result_code text,
  task_id text,
  worker text,
  fencing_token bigint,
  lease_expires_at timestamptz
)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  r public.economic_actions%ROWTYPE;
BEGIN
  IF p_worker IS NULL OR btrim(p_worker) = '' THEN
    RAISE EXCEPTION 'DOMINO02_INVALID_WORKER';
  END IF;
  IF p_lease_seconds < 1 THEN
    RAISE EXCEPTION 'DOMINO02_INVALID_LEASE';
  END IF;

  SELECT *
    INTO r
    FROM public.economic_actions
   WHERE id::text = p_task_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'TASK_NOT_FOUND', p_task_id, NULL::text, NULL::bigint, NULL::timestamptz;
    RETURN;
  END IF;

  IF r.result IS NOT NULL THEN
    RETURN QUERY SELECT false, 'TASK_ALREADY_COMPLETED', r.id::text, r.claimed_by, r.fencing_token, r.lease_expires_at;
    RETURN;
  END IF;

  IF r.lease_expires_at IS NOT NULL AND r.lease_expires_at > clock_timestamp() THEN
    RETURN QUERY SELECT false, 'LEASE_ACTIVE', r.id::text, r.claimed_by, r.fencing_token, r.lease_expires_at;
    RETURN;
  END IF;

  UPDATE public.economic_actions
     SET claimed_by = p_worker,
         lease_expires_at = clock_timestamp() + make_interval(secs => p_lease_seconds),
         fencing_token = r.fencing_token + 1
   WHERE id = r.id
  RETURNING id::text, claimed_by, fencing_token, lease_expires_at
       INTO task_id, worker, fencing_token, lease_expires_at;

  RETURN QUERY SELECT true,
                       CASE WHEN r.lease_expires_at IS NULL THEN 'CLAIMED' ELSE 'RECLAIMED' END,
                       task_id, worker, fencing_token, lease_expires_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.domino02_complete_task(
  p_task_id text,
  p_worker text,
  p_fencing_token bigint,
  p_result jsonb
)
RETURNS TABLE (
  accepted boolean,
  result_code text,
  task_id text,
  fencing_token bigint,
  final_result jsonb
)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  r public.economic_actions%ROWTYPE;
BEGIN
  SELECT *
    INTO r
    FROM public.economic_actions
   WHERE id::text = p_task_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'TASK_NOT_FOUND', p_task_id, NULL::bigint, NULL::jsonb;
    RETURN;
  END IF;

  IF r.result IS NOT NULL THEN
    IF r.claimed_by = p_worker AND r.fencing_token = p_fencing_token AND r.result = p_result THEN
      RETURN QUERY SELECT true, 'IDEMPOTENT_RETRY', r.id::text, r.fencing_token, r.result;
    ELSE
      RETURN QUERY SELECT false, 'ALREADY_COMPLETED', r.id::text, r.fencing_token, r.result;
    END IF;
    RETURN;
  END IF;

  IF r.fencing_token <> p_fencing_token OR r.claimed_by IS DISTINCT FROM p_worker THEN
    RETURN QUERY SELECT false, 'REJECT_STALE_WRITE', r.id::text, r.fencing_token, NULL::jsonb;
    RETURN;
  END IF;

  UPDATE public.economic_actions
     SET result = p_result,
         lease_expires_at = NULL
   WHERE id = r.id
     AND fencing_token = p_fencing_token
     AND claimed_by = p_worker
     AND result IS NULL
  RETURNING id::text, fencing_token, result
       INTO task_id, fencing_token, final_result;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'REJECT_STALE_WRITE', r.id::text, r.fencing_token, NULL::jsonb;
    RETURN;
  END IF;

  RETURN QUERY SELECT true, 'COMPLETED', task_id, fencing_token, final_result;
END;
$$;

COMMENT ON FUNCTION public.domino02_claim_task(text,text,integer)
IS 'DOMINO02 atomic claim/reclaim with monotonically increasing fencing generation.';
COMMENT ON FUNCTION public.domino02_complete_task(text,text,bigint,jsonb)
IS 'DOMINO02 conditional fenced completion with stale-write rejection and idempotent retry.';
