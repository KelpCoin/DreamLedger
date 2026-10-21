-- Staged only: this migration must NOT run against the un-reconciled
-- production/source database. Apply after source recovery, offer import,
-- runtime signature verification, service-role scoping and rollback proof.
--
-- Single Postgres transaction: event claim -> validated offer -> order -> outbox.
-- The external delivery worker operates AFTER COMMIT, idempotently.
-- The function must be called ONLY by a trusted backend that verifies Stripe's
-- raw-body signature and authoritative Checkout Session/payment state first.
-- A client-supplied "verified" flag is never accepted as proof.
--
-- Prevent web/mobile clients from executing this function before role grants:
-- REVOKE EXECUTE ON FUNCTION public.claim_verified_stripe_checkout(...) FROM PUBLIC;
CREATE OR REPLACE FUNCTION public.claim_verified_stripe_checkout(
  p_event_id text,
  p_event_type text,
  p_session_id text,
  p_payment_intent_id text,
  p_silo_id text,
  p_sku text,
  p_amount_cents integer,
  p_currency text,
  p_payload_sha256 text,
  p_livemode boolean,
  p_buyer_reference text
)
RETURNS TABLE (claimed boolean, order_id text, delivery_key text)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_offer record;
  v_inserted_event text;
  v_order_id text := 'ord:' || p_session_id;
  v_delivery_key text := 'deliver:' || p_session_id;
  v_inserted_order text;
  v_existing_hash text;
BEGIN
  IF p_livemode IS DISTINCT FROM TRUE OR p_event_type NOT IN
      ('checkout.session.completed','checkout.session.async_payment_succeeded') THEN
    RAISE EXCEPTION 'Only supported live paid checkout events may be claimed';
  END IF;
  IF p_event_id !~ '^evt_[A-Za-z0-9]+$'
      OR p_session_id !~ '^cs_live_[A-Za-z0-9]+$'
      OR p_payment_intent_id IS NULL
      OR p_payment_intent_id !~ '^pi_[A-Za-z0-9]+$'
      OR p_payload_sha256 !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Invalid Stripe provider identity or hash';
  END IF;
  IF p_amount_cents IS NULL OR p_amount_cents <= 0
      OR p_silo_id IS NULL OR p_sku IS NULL THEN
    RAISE EXCEPTION 'Missing or invalid monetary/product identity';
  END IF;

  -- Bind price, currency and tenant to an existing approved offer.
  SELECT offer_id, price_cents, currency INTO v_offer
  FROM public.commercial_offers
  WHERE silo_id = p_silo_id AND sku = p_sku AND status = 'active'
  FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No active offer bound to silo/SKU'; END IF;
  IF v_offer.price_cents <> p_amount_cents OR upper(v_offer.currency) <> upper(p_currency) THEN
    RAISE EXCEPTION 'Provider amount/currency mismatches canonical offer';
  END IF;

  -- INSERT FIRST: concurrent duplicate event IDs serialize on primary key.
  -- No SELECT-then-INSERT race and no early external side effect.
  INSERT INTO public.stripe_event_inbox
      (event_id,event_type,payload_sha256,livemode)
  VALUES (p_event_id,p_event_type,p_payload_sha256,true)
  ON CONFLICT (event_id) DO NOTHING
  RETURNING event_id INTO v_inserted_event;

  IF v_inserted_event IS NULL THEN
    SELECT payload_sha256 INTO v_existing_hash
    FROM public.stripe_event_inbox WHERE event_id = p_event_id;
    IF v_existing_hash IS DISTINCT FROM p_payload_sha256 THEN
      RAISE EXCEPTION 'Same event ID with conflicting event body';
    END IF;
    RETURN QUERY SELECT false, v_order_id, v_delivery_key;
    RETURN;
  END IF;

  -- Different events for the SAME paid session cannot create another order.
  INSERT INTO public.commercial_orders
    (order_id,offer_id,buyer_reference,amount_cents,currency,status,
     stripe_checkout_session_id,stripe_payment_intent_id)
  VALUES
    (v_order_id,v_offer.offer_id,p_buyer_reference,p_amount_cents,upper(p_currency),
     'PAID_UNRECONCILED',p_session_id,p_payment_intent_id)
  ON CONFLICT DO NOTHING
  RETURNING commercial_orders.order_id INTO v_inserted_order;

  IF v_inserted_order IS NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.commercial_orders
                   WHERE stripe_checkout_session_id=p_session_id
                     AND offer_id=v_offer.offer_id
                     AND amount_cents=p_amount_cents
                     AND upper(currency)=upper(p_currency)) THEN
      RAISE EXCEPTION 'Conflicting existing order for same Stripe session';
    END IF;
    RETURN QUERY SELECT false, v_order_id, v_delivery_key;
    RETURN;
  END IF;

  INSERT INTO public.commercial_fulfillment_outbox
    (delivery_key,event_id,order_id,payload,status)
  VALUES
    (v_delivery_key,p_event_id,v_order_id,
     jsonb_build_object('schema','dreamledger/stripe-delivery/v1',
         'silo_id',p_silo_id,'sku',p_sku,'offer_id',v_offer.offer_id,
         'session_id',p_session_id,'amount_minor',p_amount_cents,
         'currency',upper(p_currency),'external_action_allowed',false),
     'PENDING');

  -- This claim is not settled revenue. A separate provider reconciliation and
  -- delivery receipt are required before recognizing verified external revenue.
  RETURN QUERY SELECT true, v_order_id, v_delivery_key;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_verified_stripe_checkout(
  text,text,text,text,text,text,integer,text,text,boolean,text
) FROM PUBLIC;

-- Backend role EXECUTE grants and deployment are held until least-privilege
-- credentials, webhook endpoint, source reconciliation and CI gate exist.
-- Do not grant this to anon or authenticated browser roles.
