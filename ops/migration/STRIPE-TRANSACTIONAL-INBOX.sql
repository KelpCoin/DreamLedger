-- Isolated Neon staging addition. No claim of source migration or verified revenue.
-- The handler must INSERT the signed event and enqueue a fulfillment job in ONE
-- database transaction. External delivery occurs ONLY after COMMIT.
CREATE TABLE IF NOT EXISTS stripe_event_inbox (
 event_id TEXT PRIMARY KEY,
 event_type TEXT NOT NULL,
 payload_sha256 TEXT NOT NULL CHECK(payload_sha256 ~ '^[0-9a-f]{64}$'),
 livemode BOOLEAN NOT NULL,
 processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS commercial_fulfillment_outbox (
 delivery_key TEXT PRIMARY KEY,
 event_id TEXT NOT NULL REFERENCES stripe_event_inbox(event_id),
 order_id TEXT NOT NULL REFERENCES commercial_orders(order_id),
 payload JSONB NOT NULL,
 status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','IN_PROGRESS','DELIVERED','FAILED_REVIEW')),
 attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts>=0),
 next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 worker_id TEXT,
 lease_token TEXT,
 leased_until TIMESTAMPTZ,
 delivered_at TIMESTAMPTZ,
 receipt_sha256 TEXT CHECK(receipt_sha256 IS NULL OR receipt_sha256 ~ '^[0-9a-f]{64}$'),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 CHECK(status<>'DELIVERED' OR (delivered_at IS NOT NULL AND receipt_sha256 IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS commercial_fulfillment_due
 ON commercial_fulfillment_outbox (status,next_attempt_at,created_at);
-- Product identity must bind to its silo, not only an unqualified SKU.
ALTER TABLE commercial_offers ADD COLUMN IF NOT EXISTS silo_id TEXT;
ALTER TABLE commercial_offers ALTER COLUMN silo_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS commercial_active_offer_silo_sku
 ON commercial_offers (silo_id, sku) WHERE status='active';
-- Do not delete claimed events after an uncertain delivery outcome.
-- Retry with stable delivery_key and provider idempotency or reconcile delivery.
