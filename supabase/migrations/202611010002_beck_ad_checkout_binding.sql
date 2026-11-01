-- BECK paid ad commerce: STAGED ONLY. Requires prior migration 202611010001.
-- Do not apply without owner authorization, a verified inventory backfill and rollback.
BEGIN;

ALTER TABLE public.beck_ad_reservations
  ADD COLUMN IF NOT EXISTS checkout_session_id text,
  ADD COLUMN IF NOT EXISTS checkout_session_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS creative_title text,
  ADD COLUMN IF NOT EXISTS creative_destination_url text,
  ADD COLUMN IF NOT EXISTS creative_manifest_sha256 text,
  ADD COLUMN IF NOT EXISTS creative_review_status text NOT NULL DEFAULT 'NOT_SUBMITTED'
    CHECK (creative_review_status IN ('NOT_SUBMITTED','PENDING_REVIEW','APPROVED','REJECTED'));
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
-- One settled Stripe PaymentIntent may never fund two reservations, even when
-- distinct Checkout Sessions/events arrive concurrently. Enforced by PostgreSQL.
CREATE UNIQUE INDEX IF NOT EXISTS beck_ad_unique_payment_intent
 ON public.beck_ad_payment_receipts (payment_intent_id);
ALTER TABLE public.beck_ad_payment_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.beck_ad_payment_receipts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.beck_ad_payment_receipts TO service_role;

CREATE OR REPLACE FUNCTION public.beck_ad_bind_checkout(
 p_reservation_id uuid,p_session_id text,p_session_expires_at timestamptz,
 p_title text,p_destination_url text,p_creative_sha256 text
) RETURNS public.beck_ad_reservations
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog, public
AS $$
DECLARE r public.beck_ad_reservations; updated public.beck_ad_reservations;
BEGIN
 IF p_reservation_id IS NULL OR p_session_id IS NULL OR
    p_session_id !~ '^cs_(test|live)_[A-Za-z0-9_]+$' OR
    p_title IS NULL OR length(btrim(p_title)) NOT BETWEEN 1 AND 80 OR
    p_destination_url IS NULL OR length(p_destination_url)>500 OR
    p_destination_url !~ '^https://[^ /]+' OR
    p_creative_sha256 IS NULL OR p_creative_sha256 !~ '^[a-f0-9]{64}$'
 THEN RAISE EXCEPTION 'invalid_checkout_binding' USING ERRCODE='22023'; END IF;
 SELECT * INTO r FROM public.beck_ad_reservations WHERE reservation_id=p_reservation_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'reservation_missing' USING ERRCODE='P0001'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(r.exhaust||':'||r.silo||':'||r.canvas,0));
 SELECT * INTO r FROM public.beck_ad_reservations WHERE reservation_id=p_reservation_id FOR UPDATE;
 IF r.checkout_session_id=p_session_id THEN
   IF r.creative_manifest_sha256 IS DISTINCT FROM p_creative_sha256 OR
      r.creative_title IS DISTINCT FROM p_title OR
      r.creative_destination_url IS DISTINCT FROM p_destination_url
   THEN RAISE EXCEPTION 'creative_replay_conflict' USING ERRCODE='23505'; END IF;
   RETURN r;
 END IF;
 IF r.checkout_session_id IS NOT NULL OR r.status<>'HELD'
    OR r.hold_expires_at<=clock_timestamp() OR
    p_session_expires_at IS NULL OR
    p_session_expires_at<=clock_timestamp()+interval '24 minutes' OR
    p_session_expires_at>r.hold_expires_at-interval '5 minutes'
 THEN RAISE EXCEPTION 'checkout_binding_not_allowed' USING ERRCODE='P0001'; END IF;
 UPDATE public.beck_ad_reservations
 SET checkout_session_id=p_session_id,checkout_session_expires_at=p_session_expires_at,
     creative_title=p_title,creative_destination_url=p_destination_url,
     creative_manifest_sha256=p_creative_sha256,creative_review_status='PENDING_REVIEW',
     updated_at=clock_timestamp()
 WHERE reservation_id=p_reservation_id RETURNING * INTO updated;
 RETURN updated;
END $$;
REVOKE ALL ON FUNCTION public.beck_ad_bind_checkout(uuid,text,timestamptz,text,text,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.beck_ad_bind_checkout(uuid,text,timestamptz,text,text,text) TO service_role;

-- Caller MUST verify Stripe HMAC and independently retrieve the relevant Stripe
-- Checkout Session before invoking. SQL itself cannot authenticate Stripe.
CREATE OR REPLACE FUNCTION public.beck_ad_record_paid(
 p_reservation_id uuid,p_session_id text,p_event_id text,
 p_payment_intent_id text,p_amount_minor integer,p_currency text,p_livemode boolean,
 p_creative_sha256 text
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
    OR p_creative_sha256 IS NULL OR p_creative_sha256 !~ '^[a-f0-9]{64}$'
 THEN RAISE EXCEPTION 'payment_evidence_invalid' USING ERRCODE='22023'; END IF;
 SELECT * INTO r FROM public.beck_ad_reservations WHERE reservation_id=p_reservation_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'reservation_missing' USING ERRCODE='P0001'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(r.exhaust||':'||r.silo||':'||r.canvas,0));
 SELECT * INTO r FROM public.beck_ad_reservations WHERE reservation_id=p_reservation_id FOR UPDATE;
 IF r.checkout_session_id IS DISTINCT FROM p_session_id
    OR r.price_minor<>p_amount_minor OR r.currency<>p_currency
    OR r.exhaust<>'dreamledger' OR r.silo<>'ads' OR r.canvas<>'nz_board'
    OR r.creative_manifest_sha256 IS DISTINCT FROM p_creative_sha256
    OR r.creative_review_status<>'PENDING_REVIEW'
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
 IF r.status<>'HELD' OR r.checkout_session_expires_at IS NULL
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
REVOKE ALL ON FUNCTION public.beck_ad_record_paid(uuid,text,text,text,integer,text,boolean,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.beck_ad_record_paid(uuid,text,text,text,integer,text,boolean,text)
 TO service_role;
COMMIT;
