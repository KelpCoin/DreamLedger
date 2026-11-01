-- BECK paid ad commerce: STAGED ONLY. Requires prior migration 202611010001.
-- Do not apply without owner authorization, a verified inventory backfill and rollback.
BEGIN;

ALTER TABLE public.beck_ad_reservations
  ADD COLUMN IF NOT EXISTS checkout_session_id text,
  ADD COLUMN IF NOT EXISTS checkout_session_expires_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS beck_ad_unique_checkout_session
 ON public.beck_ad_reservations (checkout_session_id)
 WHERE checkout_session_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.beck_ad_payment_receipts (
  event_id text PRIMARY KEY CHECK (event_id ~ '^evt_[A-Za-z0-9_]+$'),
  reservation_id uuid NOT NULL UNIQUE REFERENCES public.beck_ad_reservations(reservation_id),
  checkout_session_id text NOT NULL UNIQUE,
  payment_intent_id text NOT NULL,
  amount_minor integer NOT NULL CHECK (amount_minor>0),
  currency text NOT NULL CHECK (currency='NZD'),
  livemode boolean NOT NULL CHECK (livemode=true),
  status text NOT NULL DEFAULT 'PAID_PENDING_CREATIVE_REVIEW'
    CHECK (status IN ('PAID_PENDING_CREATIVE_REVIEW','REFUND_REVIEW','DELIVERED_VERIFIED')),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.beck_ad_payment_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.beck_ad_payment_receipts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.beck_ad_payment_receipts TO service_role;

CREATE OR REPLACE FUNCTION public.beck_ad_bind_checkout(
 p_reservation_id uuid,p_session_id text,p_session_expires_at timestamptz
) RETURNS public.beck_ad_reservations
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog, public
AS $$
DECLARE r public.beck_ad_reservations; updated public.beck_ad_reservations;
BEGIN
 IF p_reservation_id IS NULL OR p_session_id IS NULL OR
    p_session_id !~ '^cs_(test|live)_[A-Za-z0-9_]+$'
 THEN RAISE EXCEPTION 'invalid_checkout_binding' USING ERRCODE='22023'; END IF;
 SELECT * INTO r FROM public.beck_ad_reservations WHERE reservation_id=p_reservation_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'reservation_missing' USING ERRCODE='P0001'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(r.exhaust||':'||r.silo||':'||r.canvas,0));
 SELECT * INTO r FROM public.beck_ad_reservations WHERE reservation_id=p_reservation_id FOR UPDATE;
 IF r.checkout_session_id=p_session_id THEN RETURN r; END IF;
 IF r.checkout_session_id IS NOT NULL OR r.status<>'HELD'
    OR r.hold_expires_at<=clock_timestamp() OR
    p_session_expires_at IS NULL OR
    p_session_expires_at<=clock_timestamp()+interval '24 minutes' OR
    p_session_expires_at>r.hold_expires_at-interval '5 minutes'
 THEN RAISE EXCEPTION 'checkout_binding_not_allowed' USING ERRCODE='P0001'; END IF;
 UPDATE public.beck_ad_reservations
 SET checkout_session_id=p_session_id,checkout_session_expires_at=p_session_expires_at,
     updated_at=clock_timestamp()
 WHERE reservation_id=p_reservation_id RETURNING * INTO updated;
 RETURN updated;
END $$;
REVOKE ALL ON FUNCTION public.beck_ad_bind_checkout(uuid,text,timestamptz)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.beck_ad_bind_checkout(uuid,text,timestamptz) TO service_role;

-- Caller MUST verify Stripe HMAC and independently retrieve the relevant Stripe
-- Checkout Session before invoking. SQL itself cannot authenticate Stripe.
CREATE OR REPLACE FUNCTION public.beck_ad_record_paid(
 p_reservation_id uuid,p_session_id text,p_event_id text,
 p_payment_intent_id text,p_amount_minor integer,p_currency text,p_livemode boolean
) RETURNS public.beck_ad_payment_receipts
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog, public
AS $$
DECLARE r public.beck_ad_reservations; existing public.beck_ad_payment_receipts;
BEGIN
 IF p_reservation_id IS NULL OR p_session_id IS NULL
    OR p_session_id !~ '^cs_live_[A-Za-z0-9_]+$'
    OR p_event_id IS NULL OR p_event_id !~ '^evt_[A-Za-z0-9_]+$'
    OR p_payment_intent_id IS NULL OR p_payment_intent_id !~ '^pi_[A-Za-z0-9_]+$'
    OR p_livemode IS DISTINCT FROM true
    OR p_amount_minor IS NULL OR p_amount_minor<>5000
    OR p_currency<>'NZD'
 THEN RAISE EXCEPTION 'payment_evidence_invalid' USING ERRCODE='22023'; END IF;
 SELECT * INTO r FROM public.beck_ad_reservations WHERE reservation_id=p_reservation_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'reservation_missing' USING ERRCODE='P0001'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(r.exhaust||':'||r.silo||':'||r.canvas,0));
 SELECT * INTO r FROM public.beck_ad_reservations WHERE reservation_id=p_reservation_id FOR UPDATE;
 IF r.checkout_session_id IS DISTINCT FROM p_session_id
    OR r.price_minor<>p_amount_minor OR r.currency<>p_currency
    OR r.exhaust<>'dreamledger' OR r.silo<>'ads' OR r.canvas<>'nz_board'
 THEN RAISE EXCEPTION 'payment_not_attributed' USING ERRCODE='P0001'; END IF;
 SELECT * INTO existing FROM public.beck_ad_payment_receipts
  WHERE reservation_id=p_reservation_id;
 IF FOUND THEN
   IF existing.checkout_session_id<>p_session_id
      OR existing.payment_intent_id<>p_payment_intent_id
      OR existing.amount_minor<>p_amount_minor OR existing.currency<>p_currency
   THEN RAISE EXCEPTION 'payment_replay_conflict' USING ERRCODE='23505'; END IF;
   RETURN existing; -- Do not record a second charge or second fulfillment.
 END IF;
 IF r.status<>'HELD' OR r.hold_expires_at<=clock_timestamp()
    OR r.checkout_session_expires_at<=clock_timestamp()-interval '7 days'
 THEN RAISE EXCEPTION 'late_or_unheld_payment_requires_refund_review'
   USING ERRCODE='P0001'; END IF;
 INSERT INTO public.beck_ad_payment_receipts (
   event_id,reservation_id,checkout_session_id,payment_intent_id,amount_minor,currency,livemode
 ) VALUES (
   p_event_id,p_reservation_id,p_session_id,p_payment_intent_id,p_amount_minor,p_currency,true
 ) RETURNING * INTO existing;
 UPDATE public.beck_ad_reservations SET status='PAID',updated_at=clock_timestamp()
 WHERE reservation_id=p_reservation_id;
 RETURN existing; -- Paid receipt is NOT verified delivery.
END $$;
REVOKE ALL ON FUNCTION public.beck_ad_record_paid(uuid,text,text,text,integer,text,boolean)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.beck_ad_record_paid(uuid,text,text,text,integer,text,boolean)
 TO service_role;
COMMIT;
