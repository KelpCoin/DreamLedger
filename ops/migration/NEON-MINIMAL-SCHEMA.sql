-- Neon minimal schema for BECK cloud-first heartbeat + commercial spine
-- Apply to Neon project. Postgres-compatible.
-- No claims of full historical migration.

CREATE TABLE IF NOT EXISTS cortex_heartbeat (
  heartbeat_id TEXT PRIMARY KEY,
  seq BIGINT,
  current_hash TEXT,
  previous_hash TEXT,
  agent_id TEXT,
  observed_at_utc TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cortex_heartbeat_observed
  ON cortex_heartbeat (observed_at_utc DESC);

CREATE TABLE IF NOT EXISTS commercial_offers (
  offer_id TEXT PRIMARY KEY,
  sku TEXT,
  name TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'NZD',
  status TEXT NOT NULL DEFAULT 'active',
  stripe_payment_link_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS commercial_orders (
  order_id TEXT PRIMARY KEY,
  offer_id TEXT REFERENCES commercial_offers(offer_id),
  buyer_reference TEXT,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'NZD',
  status TEXT NOT NULL DEFAULT 'draft',
  stripe_checkout_session_id TEXT,
  stripe_payment_intent_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS commercial_payments (
  payment_id TEXT PRIMARY KEY,
  order_id TEXT REFERENCES commercial_orders(order_id),
  stripe_payment_intent_id TEXT,
  stripe_charge_id TEXT,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'NZD',
  status TEXT NOT NULL,
  livemode BOOLEAN NOT NULL DEFAULT false,
  event_id TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One Checkout Session may produce many signed Stripe events and retries,
-- but it must not create multiple commercial orders.
CREATE UNIQUE INDEX IF NOT EXISTS idx_commercial_orders_checkout_session
  ON commercial_orders (stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;

-- A Stripe charge cannot be attributed to two different payment rows.
-- Event history belongs in evidence/ledger records, not duplicate charge rows.
CREATE UNIQUE INDEX IF NOT EXISTS idx_commercial_payments_stripe_charge
  ON commercial_payments (stripe_charge_id)
  WHERE stripe_charge_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS commercial_evidence (
  evidence_id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  source_event_id TEXT,
  event_type TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_at TIMESTAMPTZ,
  verification_method TEXT
);

CREATE TABLE IF NOT EXISTS beck_recovery_events (
  recovery_id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  action TEXT NOT NULL,
  trigger_reason TEXT,
  http_status INTEGER,
  success BOOLEAN NOT NULL DEFAULT false,
  evidence JSONB,
  observed_at_utc TIMESTAMPTZ NOT NULL DEFAULT now()
);
