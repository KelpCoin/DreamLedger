-- Batch 5: physical settlement, proof, verification boundary, and security hardening.
-- Applied to Supabase project wbwgroygjeyukkspnqiy on 2026-09-29.
-- Idempotent where practical so repository state matches the live database.

CREATE TABLE IF NOT EXISTS public.x402_settlements (
  settlement_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  toll_call_id uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  network text NOT NULL,
  asset text NOT NULL,
  amount_atomics text NOT NULL,
  amount_usdc numeric(18,6) NOT NULL,
  payer_address text NOT NULL,
  payee_address text NOT NULL,
  tx_hash text NOT NULL UNIQUE,
  block_number bigint,
  confirmations integer NOT NULL DEFAULT 0,
  facilitator_url text NOT NULL,
  facilitator_response jsonb NOT NULL DEFAULT '{}'::jsonb,
  settled_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  status text NOT NULL DEFAULT 'PENDING',
  CONSTRAINT x402_settlements_status_check CHECK (status IN ('PENDING','CONFIRMED','FAILED','REORGED')),
  CONSTRAINT x402_settlements_amount_check CHECK (amount_usdc > 0)
);

CREATE INDEX IF NOT EXISTS x402_settlements_toll_idx ON public.x402_settlements(toll_call_id);
CREATE INDEX IF NOT EXISTS x402_settlements_tx_idx ON public.x402_settlements(tx_hash);
CREATE INDEX IF NOT EXISTS x402_settlements_payer_idx ON public.x402_settlements(payer_address);
CREATE INDEX IF NOT EXISTS x402_settlements_settled_idx ON public.x402_settlements(settled_at DESC);

CREATE TABLE IF NOT EXISTS public.runtime_proofs (
  proof_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id uuid NOT NULL,
  toll_call_id uuid,
  proof_type text NOT NULL,
  request_hash text NOT NULL,
  response_hash text NOT NULL,
  artifact_hash text NOT NULL,
  previous_hash text,
  chain_hash text NOT NULL,
  source_reference text,
  source_system text,
  observed_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT runtime_proofs_type_check CHECK (
    proof_type IN ('ORCHESTRATOR_RUN','DECISION_VERDICT','FULFILLMENT_ARTIFACT','DELIVERY_RECEIPT','SETTLEMENT_RECEIPT','ECONOMIC_OUTCOME')
  )
);

CREATE INDEX IF NOT EXISTS runtime_proofs_execution_idx ON public.runtime_proofs(execution_id);
CREATE INDEX IF NOT EXISTS runtime_proofs_toll_idx ON public.runtime_proofs(toll_call_id);
CREATE INDEX IF NOT EXISTS runtime_proofs_chain_idx ON public.runtime_proofs(chain_hash);
CREATE INDEX IF NOT EXISTS runtime_proofs_observed_idx ON public.runtime_proofs(observed_at DESC);

ALTER TABLE public.economic_events ADD COLUMN IF NOT EXISTS payment_reference text;

CREATE OR REPLACE FUNCTION public.enforce_economic_event_verified()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_toll_call_id uuid;
BEGIN
  IF NEW.verification_status <> 'VERIFIED' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.verification_status = 'VERIFIED' THEN
    RETURN NEW;
  END IF;

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
      AND lower(s.payer_address) = lower(NEW.external_reference)
      AND s.amount_usdc > 0
  ) THEN
    RAISE EXCEPTION 'VERIFIED_LINK_3_FAILED: confirmed x402 settlement missing for tx % and payer %',
      NEW.payment_reference, NEW.external_reference USING ERRCODE = 'P0022';
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
    RAISE EXCEPTION 'VERIFIED_LINK_4_FAILED: fulfillment/decision proof missing for toll_call_id %',
      v_toll_call_id USING ERRCODE = 'P0023';
  END IF;

  IF NEW.evidence_ref IS NULL OR btrim(NEW.evidence_ref) = '' THEN
    RAISE EXCEPTION 'VERIFIED_LINK_5_FAILED: evidence_ref missing' USING ERRCODE = 'P0024';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.runtime_proofs p
    WHERE p.proof_id::text = NEW.evidence_ref
  ) THEN
    RAISE EXCEPTION 'VERIFIED_LINK_6_FAILED: evidence_ref % does not resolve to runtime_proofs',
      NEW.evidence_ref USING ERRCODE = 'P0025';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS economic_events_verified_guard ON public.economic_events;
CREATE TRIGGER economic_events_verified_guard
BEFORE INSERT OR UPDATE ON public.economic_events
FOR EACH ROW EXECUTE FUNCTION public.enforce_economic_event_verified();

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'economic_search_space_config','economic_search_seeds','cube_data_lakes',
    'cube_word_banks','cube_data_lake_observations','cube_word_bank_events','cube_swarm_exchange'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', t);
    EXECUTE format('DROP POLICY IF EXISTS service_role_only ON public.%I', t);
    EXECUTE format('CREATE POLICY service_role_only ON public.%I FOR ALL TO service_role USING (auth.role() = ''service_role'') WITH CHECK (auth.role() = ''service_role'')', t);
  END LOOP;
END $$;

ALTER TABLE public.x402_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.runtime_proofs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_role_only ON public.x402_settlements;
CREATE POLICY service_role_only ON public.x402_settlements
FOR ALL TO service_role USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS service_role_only ON public.runtime_proofs;
CREATE POLICY service_role_only ON public.runtime_proofs
FOR ALL TO service_role USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

REVOKE ALL ON TABLE public.x402_settlements FROM anon, authenticated;
REVOKE ALL ON TABLE public.runtime_proofs FROM anon, authenticated;
GRANT ALL ON TABLE public.x402_settlements TO service_role;
GRANT ALL ON TABLE public.runtime_proofs TO service_role;
