-- Enforce all six links on every VERIFIED write. Testnet settlements are never scoreboard-eligible.
CREATE OR REPLACE FUNCTION public.enforce_economic_event_verified()
RETURNS trigger LANGUAGE plpgsql AS $function$
DECLARE v_toll_call_id uuid;
BEGIN
  IF NEW.verification_status <> 'VERIFIED' THEN RETURN NEW; END IF;
  IF NEW.payment_reference IS NULL OR btrim(NEW.payment_reference) = '' THEN
    RAISE EXCEPTION 'VERIFIED_LINK_1_FAILED: payment_reference missing' USING ERRCODE = 'P0020';
  END IF;
  IF NEW.external_reference IS NULL OR btrim(NEW.external_reference) = '' THEN
    RAISE EXCEPTION 'VERIFIED_LINK_2_FAILED: external_reference (payer) missing' USING ERRCODE = 'P0021';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.x402_settlements s
    WHERE s.tx_hash = NEW.payment_reference
      AND s.status = 'CONFIRMED'
      AND s.network = 'eip155:8453'
      AND lower(s.asset) = lower('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913')
      AND lower(s.payer_address) = lower(NEW.external_reference)
      AND lower(s.payee_address) = lower(coalesce(NEW.metadata->>'payee',''))
      AND s.amount_usdc > 0
      AND lower(coalesce(NEW.metadata->>'testnet','true')) = 'false'
      AND lower(coalesce(NEW.metadata->>'scoreboard_eligible','false')) = 'true'
  ) THEN
    RAISE EXCEPTION 'VERIFIED_LINK_3_FAILED: confirmed Base mainnet USDC settlement and eligible payer/payee missing for tx %', NEW.payment_reference USING ERRCODE = 'P0022';
  END IF;
  v_toll_call_id := NULLIF(NEW.metadata->>'toll_call_id','')::uuid;
  IF v_toll_call_id IS NULL THEN
    RAISE EXCEPTION 'VERIFIED_LINK_4_FAILED: metadata.toll_call_id missing' USING ERRCODE = 'P0023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.runtime_proofs p
    WHERE p.toll_call_id = v_toll_call_id
      AND p.proof_type IN ('DECISION_VERDICT','FULFILLMENT_ARTIFACT','DELIVERY_RECEIPT')
  ) THEN
    RAISE EXCEPTION 'VERIFIED_LINK_4_FAILED: fulfillment/decision proof missing for toll_call_id %', v_toll_call_id USING ERRCODE = 'P0023';
  END IF;
  IF NEW.evidence_ref IS NULL OR btrim(NEW.evidence_ref) = '' THEN
    RAISE EXCEPTION 'VERIFIED_LINK_5_FAILED: evidence_ref missing' USING ERRCODE = 'P0024';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.runtime_proofs p
    WHERE p.proof_id::text = NEW.evidence_ref
  ) THEN
    RAISE EXCEPTION 'VERIFIED_LINK_6_FAILED: evidence_ref % does not resolve to runtime_proofs', NEW.evidence_ref USING ERRCODE = 'P0025';
  END IF;
  RETURN NEW;
END;
$function$;