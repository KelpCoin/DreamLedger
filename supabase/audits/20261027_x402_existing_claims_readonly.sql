-- Read-only aggregate audit of historically overclaimed x402 economic_events.
-- Run only against the authenticated ORIGINAL DreamLedger production ledger,
-- after the live schema preflight proves the named columns exist.
-- No payment IDs, buyer addresses, or other personal data are exported.
SELECT
  count(*)::bigint AS observed_x402_events,
  count(*) FILTER (WHERE verification_status='VERIFIED')::bigint AS marked_verified,
  count(*) FILTER (
    WHERE coalesce(lower(trim(metadata->>'scoreboard_eligible')),'false')='true'
  )::bigint AS scoreboard_marked_eligible,
  count(*) FILTER (
    WHERE verification_status='VERIFIED'
      AND coalesce(lower(trim(metadata->>'scoreboard_eligible')),'false')='true'
  )::bigint AS likely_premature_verified_claims
FROM public.economic_events
WHERE source_system='x402';

-- If any claims are flagged, audit their onchain confirmation and delivery
-- evidence individually before changing their economic classification.
-- A row count is only an investigation cue, NOT a revenue figure.
