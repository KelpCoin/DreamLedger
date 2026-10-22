-- Disposable CI-only Postgres fixture. No customer records or production keys.
CREATE TABLE public.commercial_offers (
  offer_id text PRIMARY KEY, silo_id text NOT NULL, sku text,
  name text NOT NULL, price_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'NZD',
  status text NOT NULL DEFAULT 'active'
);
CREATE UNIQUE INDEX commercial_active_offer_silo_sku
 ON public.commercial_offers (silo_id,sku) WHERE status='active';

CREATE TABLE public.commercial_orders (
  order_id text PRIMARY KEY, offer_id text REFERENCES public.commercial_offers(offer_id),
  buyer_reference text, amount_cents integer NOT NULL, currency text NOT NULL,
  status text NOT NULL, stripe_checkout_session_id text,
  stripe_payment_intent_id text
);
CREATE UNIQUE INDEX idx_commercial_orders_checkout_session
 ON public.commercial_orders(stripe_checkout_session_id)
 WHERE stripe_checkout_session_id IS NOT NULL;

CREATE TABLE public.stripe_event_inbox (
  event_id text PRIMARY KEY, event_type text NOT NULL,
  payload_sha256 text NOT NULL CHECK(payload_sha256 ~ '^[a-f0-9]{64}$'),
  livemode boolean NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.commercial_fulfillment_outbox (
  delivery_key text PRIMARY KEY,
  event_id text NOT NULL REFERENCES public.stripe_event_inbox(event_id),
  order_id text NOT NULL REFERENCES public.commercial_orders(order_id),
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'PENDING'
);

\i ops/migration/STRIPE-ATOMIC-CLAIM-FUNCTION.sql

INSERT INTO public.commercial_offers(offer_id,silo_id,sku,name,price_cents,currency,status)
VALUES ('offer_hoodie','DREAMMEEZ','COSMIC-HOODIE','Cosmic Hoodie',500,'NZD','active');

DO $$
DECLARE v record; bad boolean;
BEGIN
 SELECT * INTO v FROM public.claim_verified_stripe_checkout(
  'evt_A01','checkout.session.completed','cs_live_A01','pi_A01',
  'DREAMMEEZ','COSMIC-HOODIE',500,'NZD',repeat('a',64),true,null);
 IF NOT v.claimed OR v.order_id <> 'ord:cs_live_A01' THEN
  RAISE EXCEPTION 'first signed-event claim failed';
 END IF;
 SELECT * INTO v FROM public.claim_verified_stripe_checkout(
  'evt_A01','checkout.session.completed','cs_live_A01','pi_A01',
  'DREAMMEEZ','COSMIC-HOODIE',500,'NZD',repeat('a',64),true,null);
 IF v.claimed THEN RAISE EXCEPTION 'duplicate event claimed twice'; END IF;

 -- Different signed event for the same paid session cannot duplicate an order.
 SELECT * INTO v FROM public.claim_verified_stripe_checkout(
  'evt_B01','checkout.session.completed','cs_live_A01','pi_A01',
  'DREAMMEEZ','COSMIC-HOODIE',500,'NZD',repeat('b',64),true,null);
 IF v.claimed THEN RAISE EXCEPTION 'duplicate checkout session claimed twice'; END IF;

 bad := false;
 BEGIN
  PERFORM * FROM public.claim_verified_stripe_checkout(
   'evt_WRONG','checkout.session.completed','cs_live_WRONG','pi_WRONG',
   'DREAMMEEZ','COSMIC-HOODIE',200,'NZD',repeat('c',64),true,null);
 EXCEPTION WHEN OTHERS THEN bad := true;
 END;
 IF NOT bad THEN RAISE EXCEPTION 'wrong amount was accepted'; END IF;

 bad := false;
 BEGIN
  PERFORM * FROM public.claim_verified_stripe_checkout(
   'evt_FAKE','checkout.session.completed','cs_live_FAKE','pi_FAKE',
   'DREAMMEEZ','COSMIC-HOODIE',500,'NZD',repeat('d',64),false,null);
 EXCEPTION WHEN OTHERS THEN bad := true;
 END;
 IF NOT bad THEN RAISE EXCEPTION 'testmode event was accepted'; END IF;

 IF (SELECT count(*) FROM public.commercial_orders) <> 1
    OR (SELECT count(*) FROM public.commercial_fulfillment_outbox) <> 1
    OR (SELECT count(*) FROM public.stripe_event_inbox) <> 2 THEN
  RAISE EXCEPTION 'unexpected order/outbox/inbox row count';
 END IF;
 RAISE NOTICE 'ATOMIC_CLAIM_SERIAL_REPLAY=PASS';
END $$;
