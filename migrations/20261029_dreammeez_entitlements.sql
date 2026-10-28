-- DreamMeez ownership is a server ledger, not browser-local wardrobe state.
-- A grant is held by trusted reconciliation, never a checkout redirect.
CREATE TABLE IF NOT EXISTS public.dreammeez_entitlements (
  account_id text NOT NULL CHECK (account_id ~ '^u_[a-f0-9]{24}$'),
  item_id text NOT NULL CHECK (item_id ~ '^[a-z0-9-]{3,64}$'),
  sku text NOT NULL CHECK (length(sku) BETWEEN 3 AND 128),
  source_event_id text NOT NULL REFERENCES public.stripe_event_inbox(event_id),
  source_payment_id text NOT NULL REFERENCES public.commercial_payments(payment_id),
  grant_status text NOT NULL DEFAULT 'active'
     CHECK (grant_status IN ('active','revoked')),
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  PRIMARY KEY (account_id,item_id),
  CONSTRAINT dreammeez_source_event_unique UNIQUE (source_event_id,item_id),
  CONSTRAINT dreammeez_source_payment_unique UNIQUE (source_payment_id,item_id),
  CONSTRAINT revoked_has_timestamp CHECK (grant_status <> 'revoked' OR revoked_at IS NOT NULL)
);
REVOKE ALL ON public.dreammeez_entitlements FROM PUBLIC;
COMMENT ON TABLE public.dreammeez_entitlements IS
  'Server-only DreamMeez entitlements. A trusted reconciler grants only after matching verified Stripe payment and session to a securely authenticated account. No client write or self-grants.';
