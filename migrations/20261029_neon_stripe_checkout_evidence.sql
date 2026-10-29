CREATE TABLE IF NOT EXISTS public.commercial_event_quarantine (
 event_id text PRIMARY KEY REFERENCES public.stripe_event_inbox(event_id),
 reason text NOT NULL CHECK (reason IN ('UNMATCHED_ORDER','ORDER_CONTRACT_MISMATCH')),
 observed_at timestamptz NOT NULL DEFAULT now(),
 resolved_at timestamptz
);

CREATE OR REPLACE FUNCTION public.record_checkout_evidence(
 p_event_id text, p_event_type text, p_payload_sha256 text,
 p_livemode boolean, p_order_id text, p_session_id text,
 p_payment_intent text, p_amount_cents integer, p_currency text,
 p_offer_id text, p_silo_id text
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public, pg_catalog
AS $fn$
DECLARE
  original_hash text;
  existing_type text;
  existing_live boolean;
  found_order public.commercial_orders%ROWTYPE;
  found_offer public.commercial_offers%ROWTYPE;
  quarantine_reason text;
BEGIN
 IF p_event_id IS NULL OR p_event_id !~ '^evt_[A-Za-z0-9]{5,128}$'
 OR p_event_type IS NULL OR p_event_type NOT IN ('checkout.session.completed', 'checkout.session.async_payment_succeeded')
 OR p_payload_sha256 IS NULL OR p_payload_sha256 !~ '^[a-f0-9]{64}$'
 OR p_livemode IS NULL OR p_order_id IS NULL OR length(p_order_id) NOT BETWEEN 4 AND 128
 OR p_session_id IS NULL OR p_session_id !~ '^cs_[A-Za-z0-9_]{8,128}$'
 OR p_amount_cents IS NULL OR p_amount_cents <= 0
 OR p_currency IS NULL OR p_currency !~ '^[A-Z]{3}$'
 OR p_offer_id IS NULL OR length(p_offer_id) NOT BETWEEN 3 AND 128
 OR p_silo_id IS NULL OR p_silo_id !~ '^[a-z0-9-]{2,64}$' THEN
   RAISE EXCEPTION 'INVALID_SIGNED_EVENT_ENVELOPE' USING ERRCODE='22023';
 END IF;
 -- Caller must authenticate provider signature BEFORE invoking this function.
 -- A static SQL grant alone does not authenticate Stripe.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_event_id,0));
 SELECT payload_sha256,event_type,livemode INTO original_hash,existing_type,existing_live
 FROM public.stripe_event_inbox WHERE event_id=p_event_id FOR UPDATE;
 IF FOUND THEN
   IF original_hash <> p_payload_sha256 OR existing_type <> p_event_type OR existing_live <> p_livemode THEN
     RAISE EXCEPTION 'STRIPE_EVENT_REPLAY_CONFLICT' USING ERRCODE='23505';
   END IF;
   RETURN jsonb_build_object('state','DUPLICATE','independent_settlement_verified',false);
 END IF;
 INSERT INTO public.stripe_event_inbox (event_id,event_type,payload_sha256,livemode)
 VALUES (p_event_id,p_event_type,p_payload_sha256,p_livemode);

 SELECT * INTO found_order FROM public.commercial_orders
 WHERE order_id=p_order_id FOR UPDATE;
 IF NOT FOUND THEN
   quarantine_reason := 'UNMATCHED_ORDER';
 ELSE
   SELECT * INTO found_offer FROM public.commercial_offers
   WHERE offer_id=found_order.offer_id;
   IF NOT FOUND OR found_order.offer_id IS DISTINCT FROM p_offer_id
      OR found_order.amount_cents IS DISTINCT FROM p_amount_cents
      OR upper(found_order.currency) IS DISTINCT FROM p_currency
      OR found_order.stripe_checkout_session_id IS DISTINCT FROM p_session_id
      OR found_offer.silo_id IS DISTINCT FROM p_silo_id THEN
     quarantine_reason := 'ORDER_CONTRACT_MISMATCH';
   END IF;
 END IF;
 IF quarantine_reason IS NOT NULL THEN
   INSERT INTO public.commercial_event_quarantine(event_id,reason)
   VALUES(p_event_id,quarantine_reason);
   RETURN jsonb_build_object('state','QUARANTINED','reason',quarantine_reason,
                            'independent_settlement_verified',false);
 END IF;
 IF found_order.status IN ('draft','checkout_pending','payment_pending') THEN
   UPDATE public.commercial_orders
   SET status='PAYMENT_REPORTED_NOT_SETTLED',
       stripe_payment_intent_id=p_payment_intent
   WHERE order_id=p_order_id;
 END IF;
 INSERT INTO public.commercial_payments(
   payment_id,order_id,stripe_payment_intent_id,amount_cents,currency,
   status,livemode,event_id
 ) VALUES ('checkout:'||p_session_id,p_order_id,p_payment_intent,
   p_amount_cents,p_currency,'REPORTED_NOT_RECONCILED',p_livemode,p_event_id)
 ON CONFLICT (payment_id) DO NOTHING;
 -- Delivery remains unstarted until external settlement and fulfillment
 -- contract are separately verified. Do not queue an automatic dispatch here.
 RETURN jsonb_build_object('state','PAYMENT_REPORTED','independent_settlement_verified',false,
                           'fulfillment_queued',false);
END
$fn$;

REVOKE ALL ON FUNCTION public.record_checkout_evidence(text,text,text,boolean,text,text,text,integer,text,text,text) FROM PUBLIC;

COMMENT ON FUNCTION public.record_checkout_evidence(text,text,text,boolean,text,text,text,integer,text,text,text)
 IS 'BECK staging: signed-Stripe caller only, durable event quarantine and idempotent record, not settlement or revenue proof';
