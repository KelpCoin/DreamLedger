-- Guest Stripe purchases must be representable without a DreamLedger account.
ALTER TABLE public.dreamledger_orders
  ALTER COLUMN principal_id DROP NOT NULL;

-- Stripe event IDs are the idempotency key. Preserve the existing unique index if present.
CREATE UNIQUE INDEX IF NOT EXISTS dreamledger_evidence_event_id_key
  ON public.dreamledger_evidence (event_id);
