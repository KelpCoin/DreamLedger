-- BECKO: candidate SQL for disposable PostgreSQL verification ONLY.
-- NOT APPLIED TO NEON / SUPABASE. The source payment handler MUST independently
-- verify Stripe signature, retrieve live checkout and line items, enforce
-- payment_status=paid and policy authorization BEFORE invoking this function.
-- DB accepts trusted, validated arguments, NOT an untrusted raw webhook.
-- All rows live in the same Postgres transaction; external delivery is separate.
BEGIN;

ALTER TABLE public.commercial_fulfillment_outbox
  ADD COLUMN IF NOT EXISTS last_error text;

CREATE OR REPLACE FUNCTION public.becko_accept_checkout_v1(
  p_event_id text, p_event_type text, p_payload_sha256 text,
  p_session_id text, p_payment_intent_id text, p_offer_id text,
  p_amount_cents integer, p_currency text, p_silo_id text,
  p_delivery_ref text, p_verified_livemode boolean
) RETURNS text
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public
AS $func$
DECLARE
  v_offer public.commercial_offers%ROWTYPE;
  v_event public.stripe_event_inbox%ROWTYPE;
  v_order public.commercial_orders%ROWTYPE;
  v_payment public.commercial_payments%ROWTYPE;
  v_delivery public.commercial_fulfillment_outbox%ROWTYPE;
  v_order_id text := 'stripe_session:' || p_session_id;
  v_payment_id text := 'stripe_pi:' || p_payment_intent_id;
  v_key text := 'stripe_delivery:' || p_session_id;
BEGIN
  IF p_verified_livemode IS DISTINCT FROM true
      OR p_event_id IS NULL OR p_event_id !~ '^evt_[A-Za-z0-9_]+$'
      OR p_event_type NOT IN ('checkout.session.completed',
                             'checkout.session.async_payment_succeeded')
      OR p_payload_sha256 IS NULL OR p_payload_sha256 !~ '^[0-9a-f]{64}$'
      OR p_session_id IS NULL OR p_session_id !~ '^cs_live_[A-Za-z0-9_]+$'
      OR p_payment_intent_id IS NULL OR p_payment_intent_id !~ '^pi_[A-Za-z0-9_]+$'
      OR p_offer_id IS NULL OR length(p_offer_id) NOT BETWEEN 1 AND 150
      OR p_amount_cents IS NULL OR p_amount_cents <= 0
      OR p_currency IS DISTINCT FROM 'NZD'
      OR p_silo_id IS NULL OR length(p_silo_id) NOT BETWEEN 1 AND 64
      OR p_delivery_ref IS NULL OR length(p_delivery_ref) NOT BETWEEN 1 AND 160
  THEN RAISE EXCEPTION 'BECKO_ENVELOPE_REFUSED'; END IF;

  -- Event IDs may differ for a single Checkout Session: serialize by session.
  PERFORM pg_advisory_xact_lock(hashtextextended(v_order_id, 0));
  SELECT * INTO v_offer FROM public.commercial_offers
    WHERE offer_id=p_offer_id AND status='active' FOR SHARE;
  IF NOT FOUND OR v_offer.price_cents IS DISTINCT FROM p_amount_cents
      OR v_offer.currency IS DISTINCT FROM p_currency
      OR v_offer.silo_id IS DISTINCT FROM p_silo_id
  THEN RAISE EXCEPTION 'BECKO_OFFER_PRICE_SILO_REFUSED'; END IF;

  INSERT INTO public.stripe_event_inbox(event_id,event_type,payload_sha256,livemode)
    VALUES(p_event_id,p_event_type,p_payload_sha256,true)
    ON CONFLICT (event_id) DO NOTHING;
  SELECT * INTO STRICT v_event FROM public.stripe_event_inbox
    WHERE event_id=p_event_id;
  IF v_event.event_type IS DISTINCT FROM p_event_type
      OR v_event.payload_sha256 IS DISTINCT FROM p_payload_sha256
      OR v_event.livemode IS DISTINCT FROM true
  THEN RAISE EXCEPTION 'BECKO_EVENT_COLLISION'; END IF;

  INSERT INTO public.commercial_orders(
      order_id,offer_id,amount_cents,currency,status,
      stripe_checkout_session_id,stripe_payment_intent_id)
    VALUES(v_order_id,p_offer_id,p_amount_cents,p_currency,'paid',
           p_session_id,p_payment_intent_id)
    ON CONFLICT(order_id) DO NOTHING;
  SELECT * INTO STRICT v_order FROM public.commercial_orders
    WHERE order_id=v_order_id FOR UPDATE;
  IF v_order.offer_id IS DISTINCT FROM p_offer_id
      OR v_order.amount_cents IS DISTINCT FROM p_amount_cents
      OR v_order.currency IS DISTINCT FROM p_currency
      OR v_order.stripe_payment_intent_id IS DISTINCT FROM p_payment_intent_id
      OR v_order.stripe_checkout_session_id IS DISTINCT FROM p_session_id
      OR v_order.status <> 'paid'
  THEN RAISE EXCEPTION 'BECKO_ORDER_STATE_COLLISION'; END IF;

  INSERT INTO public.commercial_payments(
      payment_id,order_id,stripe_payment_intent_id,
      amount_cents,currency,status,livemode,event_id)
    VALUES(v_payment_id,v_order_id,p_payment_intent_id,
           p_amount_cents,p_currency,'paid',true,p_event_id)
    ON CONFLICT(payment_id) DO NOTHING;
  SELECT * INTO STRICT v_payment FROM public.commercial_payments
    WHERE payment_id=v_payment_id;
  IF v_payment.order_id IS DISTINCT FROM v_order_id
      OR v_payment.stripe_payment_intent_id IS DISTINCT FROM p_payment_intent_id
      OR v_payment.amount_cents IS DISTINCT FROM p_amount_cents
      OR v_payment.currency IS DISTINCT FROM p_currency
      OR v_payment.status <> 'paid' OR v_payment.livemode IS DISTINCT FROM true
  THEN RAISE EXCEPTION 'BECKO_PAYMENT_COLLISION'; END IF;

  INSERT INTO public.commercial_fulfillment_outbox(
      delivery_key,event_id,order_id,payload,status)
    VALUES(v_key,p_event_id,v_order_id,
      jsonb_build_object('silo_id',p_silo_id,'offer_id',p_offer_id,
        'sku',v_offer.sku,'delivery_ref',p_delivery_ref,
        'checkout_session_id',p_session_id), 'PENDING')
    ON CONFLICT(delivery_key) DO NOTHING;
  SELECT * INTO STRICT v_delivery FROM public.commercial_fulfillment_outbox
    WHERE delivery_key=v_key;
  IF v_delivery.order_id IS DISTINCT FROM v_order_id
      OR v_delivery.payload->>'silo_id' IS DISTINCT FROM p_silo_id
      OR v_delivery.payload->>'offer_id' IS DISTINCT FROM p_offer_id
      OR v_delivery.payload->>'delivery_ref' IS DISTINCT FROM p_delivery_ref
  THEN RAISE EXCEPTION 'BECKO_DELIVERY_COLLISION'; END IF;

  -- This is event-observation evidence, not verified money or customer delivery.
  INSERT INTO public.commercial_evidence(evidence_id,source,source_event_id,
                                         event_type,payload_hash)
    VALUES('stripe_event:'||p_event_id,'TRUSTED_HANDLER_CANDIDATE',
      p_event_id,p_event_type,p_payload_sha256)
    ON CONFLICT(evidence_id) DO NOTHING;

  RETURN v_key;
END;
$func$;

CREATE OR REPLACE FUNCTION public.becko_claim_v1(
  p_worker_id text, p_limit integer DEFAULT 3, p_max_attempts integer DEFAULT 5,
  p_lease_seconds integer DEFAULT 300
) RETURNS TABLE(delivery_key text, lease_token text, attempts integer, payload jsonb)
LANGUAGE plpgsql SECURITY INVOKER
SET search_path=pg_catalog,public
AS $func$
BEGIN
  IF p_worker_id IS NULL OR length(p_worker_id) NOT BETWEEN 1 AND 100
      OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 20
      OR p_max_attempts IS NULL OR p_max_attempts NOT BETWEEN 1 AND 20
      OR p_lease_seconds IS NULL OR p_lease_seconds NOT BETWEEN 30 AND 1800
  THEN RAISE EXCEPTION 'BECKO_LEASE_PARAMETERS_REFUSED'; END IF;

  -- Jobs at max attempts cannot be re-claimed, including crashed jobs.
  UPDATE public.commercial_fulfillment_outbox o
    SET status='FAILED_REVIEW',worker_id=NULL,lease_token=NULL,
        leased_until=NULL,last_error='MAX_ATTEMPTS_EXCEEDED',updated_at=now()
    WHERE o.attempts>=p_max_attempts
      AND ((o.status='PENDING' AND o.next_attempt_at<=now())
        OR (o.status='IN_PROGRESS' AND o.leased_until<now()));
  RETURN QUERY
    WITH due AS (
      SELECT o.delivery_key
        FROM public.commercial_fulfillment_outbox o
        WHERE o.attempts<p_max_attempts
          AND ((o.status='PENDING' AND o.next_attempt_at<=now())
            OR (o.status='IN_PROGRESS' AND o.leased_until<now()))
        ORDER BY o.next_attempt_at,o.created_at,o.delivery_key
        FOR UPDATE SKIP LOCKED LIMIT p_limit
    )
    UPDATE public.commercial_fulfillment_outbox o
      SET status='IN_PROGRESS',worker_id=p_worker_id,
          lease_token=gen_random_uuid()::text,
          leased_until=now()+make_interval(secs=>p_lease_seconds),
          attempts=o.attempts+1,updated_at=now()
    FROM due WHERE o.delivery_key=due.delivery_key
    RETURNING o.delivery_key,o.lease_token,o.attempts,o.payload;
END;
$func$;

CREATE OR REPLACE FUNCTION public.becko_confirm_v1(
  p_delivery_key text, p_worker_id text, p_lease_token text, p_receipt_sha256 text
) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER
SET search_path=pg_catalog,public
AS $func$
BEGIN
  IF p_receipt_sha256 IS NULL OR p_receipt_sha256 !~ '^[0-9a-f]{64}$'
    THEN RAISE EXCEPTION 'BECKO_RECEIPT_REFUSED'; END IF;
  UPDATE public.commercial_fulfillment_outbox
    SET status='DELIVERED',delivered_at=now(),receipt_sha256=p_receipt_sha256,
        leased_until=NULL,lease_token=NULL,worker_id=NULL,updated_at=now()
    WHERE delivery_key=p_delivery_key AND worker_id=p_worker_id
      AND lease_token=p_lease_token AND leased_until>now()
      AND status='IN_PROGRESS';
  IF NOT FOUND THEN RAISE EXCEPTION 'BECKO_STALE_LEASE_REFUSED'; END IF;
  RETURN true;
END;
$func$;

CREATE OR REPLACE FUNCTION public.becko_retry_v1(
  p_delivery_key text, p_worker_id text, p_lease_token text,
  p_reason text, p_max_attempts integer DEFAULT 5
) RETURNS text LANGUAGE plpgsql SECURITY INVOKER
SET search_path=pg_catalog,public
AS $func$
DECLARE v_status text;
BEGIN
  IF p_max_attempts IS NULL OR p_max_attempts NOT BETWEEN 1 AND 20
    THEN RAISE EXCEPTION 'BECKO_MAX_ATTEMPTS_REFUSED'; END IF;
  UPDATE public.commercial_fulfillment_outbox
    SET status=CASE WHEN attempts >= p_max_attempts
          THEN 'FAILED_REVIEW' ELSE 'PENDING' END,
        next_attempt_at=now()+make_interval(secs=>least(1800,5*power(2,attempts)::integer)),
        last_error=left(coalesce(p_reason,'DELIVERY_FAILURE'),300),
        leased_until=NULL,lease_token=NULL,worker_id=NULL,updated_at=now()
    WHERE delivery_key=p_delivery_key AND worker_id=p_worker_id
      AND lease_token=p_lease_token AND leased_until>now()
      AND status='IN_PROGRESS'
    RETURNING status INTO v_status;
  IF NOT FOUND THEN RAISE EXCEPTION 'BECKO_STALE_LEASE_REFUSED'; END IF;
  RETURN v_status;
END;
$func$;

-- Production remains DISABLED: do NOT grant EXECUTE to web, authenticated
-- users, agents, or any service role until a separate credential and authorization
-- review. CI invokes the functions as the isolated disposable postgres owner.
REVOKE ALL ON FUNCTION public.becko_accept_checkout_v1(text,text,text,text,text,text,integer,text,text,text,boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.becko_claim_v1(text,integer,integer,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.becko_confirm_v1(text,text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.becko_retry_v1(text,text,text,text,integer) FROM PUBLIC;
COMMIT;
