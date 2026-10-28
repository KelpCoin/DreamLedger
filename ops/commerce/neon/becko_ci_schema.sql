-- CI-only reproduction of the ACTUAL Neon commercial table structure
-- inspected on 2026-10-28; all data is synthetic and local to disposable PG.
CREATE TABLE public.commercial_offers (
 offer_id text PRIMARY KEY,sku text,name text NOT NULL,
 price_cents integer NOT NULL,currency text NOT NULL DEFAULT 'NZD',
 status text NOT NULL DEFAULT 'active',stripe_payment_link_url text,
 created_at timestamptz NOT NULL DEFAULT now(),silo_id text NOT NULL
);
CREATE UNIQUE INDEX commercial_active_offer_silo_sku ON public.commercial_offers(silo_id,sku) WHERE status='active';
CREATE TABLE public.stripe_event_inbox (
 event_id text PRIMARY KEY,event_type text NOT NULL,payload_sha256 text NOT NULL,
 livemode boolean NOT NULL,processed_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT stripe_event_inbox_payload_sha256_check CHECK(payload_sha256 ~ '^[0-9a-f]{64}$')
);
CREATE TABLE public.commercial_orders (
 order_id text PRIMARY KEY,offer_id text REFERENCES public.commercial_offers(offer_id),
 buyer_reference text,amount_cents integer NOT NULL,
 currency text NOT NULL DEFAULT 'NZD',status text NOT NULL DEFAULT 'draft',
 stripe_checkout_session_id text,stripe_payment_intent_id text,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_commercial_orders_checkout_session ON public.commercial_orders(stripe_checkout_session_id)
 WHERE stripe_checkout_session_id IS NOT NULL;
CREATE TABLE public.commercial_payments (
 payment_id text PRIMARY KEY,order_id text REFERENCES public.commercial_orders(order_id),
 stripe_payment_intent_id text,stripe_charge_id text,amount_cents integer NOT NULL,
 currency text NOT NULL DEFAULT 'NZD',status text NOT NULL,livemode boolean NOT NULL DEFAULT false,
 event_id text UNIQUE,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_commercial_payments_stripe_charge ON public.commercial_payments(stripe_charge_id)
 WHERE stripe_charge_id IS NOT NULL;
CREATE TABLE public.commercial_fulfillment_outbox (
 delivery_key text PRIMARY KEY,event_id text NOT NULL REFERENCES public.stripe_event_inbox(event_id),
 order_id text NOT NULL REFERENCES public.commercial_orders(order_id),payload jsonb NOT NULL,
 status text NOT NULL DEFAULT 'PENDING',attempts integer NOT NULL DEFAULT 0,
 next_attempt_at timestamptz NOT NULL DEFAULT now(),worker_id text,lease_token text,
 leased_until timestamptz,delivered_at timestamptz,receipt_sha256 text,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT commercial_fulfillment_outbox_status_check CHECK(status IN ('PENDING','IN_PROGRESS','DELIVERED','FAILED_REVIEW')),
 CONSTRAINT commercial_fulfillment_outbox_attempts_check CHECK(attempts>=0),
 CONSTRAINT commercial_fulfillment_outbox_receipt_sha256_check CHECK(receipt_sha256 IS NULL OR receipt_sha256 ~ '^[0-9a-f]{64}$'),
 CONSTRAINT commercial_fulfillment_outbox_check CHECK(status <> 'DELIVERED' OR (delivered_at IS NOT NULL AND receipt_sha256 IS NOT NULL))
);
CREATE INDEX commercial_fulfillment_due ON public.commercial_fulfillment_outbox(status,next_attempt_at,created_at);
CREATE TABLE public.commercial_evidence(
 evidence_id text PRIMARY KEY,source text NOT NULL,source_event_id text,
 event_type text NOT NULL,payload_hash text NOT NULL,
 observed_at timestamptz NOT NULL DEFAULT now(),verified_at timestamptz,
 verification_method text
);
INSERT INTO public.commercial_offers(offer_id,sku,name,price_cents,currency,status,silo_id)
VALUES ('offer-mtg-test','MTG-TEST','CI synthetic MTG diagnostic',2500,'NZD','active','mtg'),
('offer-adult-test','ADULT-TEST','CI synthetic isolated offer',700,'NZD','active','adult');
-- Permission probe uses separate role, but no data is ever exposed to it.
CREATE ROLE becko_untrusted NOLOGIN;
