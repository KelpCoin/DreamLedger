-- Phase 0 commercial schema (Postgres-compatible)
-- Apply when ready; SQLite mirror may omit some types.

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

CREATE TABLE IF NOT EXISTS commercial_fulfillments (
  fulfillment_id TEXT PRIMARY KEY,
  order_id TEXT REFERENCES commercial_orders(order_id),
  method TEXT NOT NULL,
  status TEXT NOT NULL,
  delivered_at TIMESTAMPTZ,
  evidence_id TEXT
);

CREATE TABLE IF NOT EXISTS commercial_economic_events (
  economic_event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  order_id TEXT,
  payment_id TEXT,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'NZD',
  evidence_ids JSONB,
  finalized_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  counts_as_verified_external_revenue BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS commercial_actions (
  action_id TEXT PRIMARY KEY,
  mission_id TEXT,
  agent_id TEXT,
  action_type TEXT NOT NULL,
  parameters_hash TEXT,
  maximum_spend_cents INTEGER,
  currency TEXT DEFAULT 'NZD',
  expires_at TIMESTAMPTZ,
  approved_by TEXT,
  status TEXT NOT NULL DEFAULT 'proposed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  executed_at TIMESTAMPTZ,
  result_id TEXT
);
