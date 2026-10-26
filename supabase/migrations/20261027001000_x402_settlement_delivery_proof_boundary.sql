-- BECK x402: additive-only payment and delivery evidence fields.
-- REVIEW-GATED: not applied until production schema is independently readable.
-- No payment or delivery status is backfilled and no revenue is certified.
BEGIN;

DO $preflight$
DECLARE
  tbl text;
  col_name text;
  col_type text;
  actual_type text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['economic_events','agent_toll_calls','x402_settlements','runtime_proofs']
  LOOP
    IF to_regclass('public.' || tbl) IS NULL THEN
      RAISE EXCEPTION 'BECK_X402_REQUIRED_TABLE_MISSING: %', tbl;
    END IF;
  END LOOP;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='economic_events'
      AND column_name='verification_status'
  ) THEN
    RAISE EXCEPTION 'BECK_X402_VERIFICATION_COLUMN_MISSING';
  END IF;
  -- Never silently retain an incompatible pre-existing column type.
  FOR col_name,col_type IN
    SELECT name, dtype FROM (VALUES
      ('payment_settled','boolean'),
      ('delivery_verified','boolean'),
      ('artifact_sha256','text')
    ) AS wanted(name,dtype)
  LOOP
    SELECT format_type(a.atttypid,a.atttypmod) INTO actual_type
    FROM pg_attribute a WHERE a.attrelid='public.economic_events'::regclass
      AND a.attname=col_name AND a.attnum>0 AND NOT a.attisdropped;
    IF actual_type IS NOT NULL AND actual_type <> col_type THEN
      RAISE EXCEPTION 'BECK_X402_EXISTING_COLUMN_TYPE_MISMATCH: % (%)', col_name, actual_type;
    END IF;
    actual_type := NULL;
  END LOOP;
END;
$preflight$;

ALTER TABLE public.economic_events
  ADD COLUMN IF NOT EXISTS payment_settled boolean NOT NULL DEFAULT false;
ALTER TABLE public.economic_events
  ADD COLUMN IF NOT EXISTS delivery_verified boolean NOT NULL DEFAULT false;
ALTER TABLE public.economic_events
  ADD COLUMN IF NOT EXISTS artifact_sha256 text;

-- Hash is of exact delivered artifact bytes: lowercase SHA-256, no 0x.
-- No hash, settlement receipt, or response sent is itself a delivery confirmation.
DO $constraints$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
    WHERE conrelid='public.economic_events'::regclass
      AND conname='economic_events_x402_artifact_sha256_format_ck') THEN
    ALTER TABLE public.economic_events
      ADD CONSTRAINT economic_events_x402_artifact_sha256_format_ck
      CHECK (artifact_sha256 IS NULL OR artifact_sha256 ~ '^[0-9a-f]{64}$') NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
    WHERE conrelid='public.economic_events'::regclass
      AND conname='economic_events_x402_scoreboard_truth_ck') THEN
    ALTER TABLE public.economic_events
      ADD CONSTRAINT economic_events_x402_scoreboard_truth_ck
      CHECK (
        source_system IS DISTINCT FROM 'x402'
        OR coalesce(metadata->>'scoreboard_eligible','false') <> 'true'
        OR (payment_settled IS TRUE
            AND delivery_verified IS TRUE
            AND artifact_sha256 ~ '^[0-9a-f]{64}$'
            AND verification_status = 'VERIFIED')
      ) NOT VALID;
  END IF;
END;
$constraints$;
COMMIT;
