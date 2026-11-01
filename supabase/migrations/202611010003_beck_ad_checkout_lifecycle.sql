-- BECK paid checkout release, STAGED ONLY. Requires approved migrations 001 and 002.
-- Never release a bound placement merely because its hold timer elapsed.
-- Only a service-role worker that independently queries Stripe may call this.
BEGIN;
CREATE TABLE IF NOT EXISTS public.beck_ad_checkout_releases (
  reservation_id uuid PRIMARY KEY REFERENCES public.beck_ad_reservations(reservation_id),
  checkout_session_id text NOT NULL UNIQUE,
  provider_status text NOT NULL CHECK (provider_status='expired'),
  provider_payment_status text NOT NULL CHECK (provider_payment_status='unpaid'),
  reconciliation_sha256 text NOT NULL CHECK (reconciliation_sha256 ~ '^[a-f0-9]{64}$'),
  provider_checked_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.beck_ad_checkout_releases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.beck_ad_checkout_releases FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.beck_ad_checkout_releases TO service_role;

CREATE OR REPLACE FUNCTION public.beck_ad_release_expired_checkout(
  p_reservation_id uuid,p_checkout_session_id text,
  p_status text,p_payment_status text,p_sha256 text,p_checked_at timestamptz
) RETURNS public.beck_ad_checkout_releases
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public
AS $$
DECLARE r public.beck_ad_reservations; receipt public.beck_ad_checkout_releases;
BEGIN
 IF p_reservation_id IS NULL OR p_checkout_session_id IS NULL
    OR p_checkout_session_id !~ '^cs_(test|live)_[A-Za-z0-9_]+$'
    OR p_status IS DISTINCT FROM 'expired'
    OR p_payment_status IS DISTINCT FROM 'unpaid'
    OR p_sha256 IS NULL OR p_sha256 !~ '^[a-f0-9]{64}$'
    OR p_checked_at IS NULL
    OR p_checked_at>clock_timestamp()+interval '30 seconds'
    OR p_checked_at<clock_timestamp()-interval '5 minutes'
 THEN RAISE EXCEPTION 'invalid_release_evidence' USING ERRCODE='22023'; END IF;
 SELECT * INTO r FROM public.beck_ad_reservations WHERE reservation_id=p_reservation_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'reservation_missing' USING ERRCODE='P0001'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(r.exhaust||':'||r.silo||':'||r.canvas,0));
 SELECT * INTO r FROM public.beck_ad_reservations WHERE reservation_id=p_reservation_id FOR UPDATE;
 SELECT * INTO receipt FROM public.beck_ad_checkout_releases
 WHERE reservation_id=p_reservation_id;
 IF FOUND THEN
   IF receipt.checkout_session_id IS DISTINCT FROM p_checkout_session_id
      OR receipt.reconciliation_sha256 IS DISTINCT FROM p_sha256
   THEN RAISE EXCEPTION 'release_replay_conflict' USING ERRCODE='23505'; END IF;
   RETURN receipt;
 END IF;
 IF r.checkout_session_id IS DISTINCT FROM p_checkout_session_id
    OR r.status IS DISTINCT FROM 'HELD'
    OR r.checkout_session_expires_at>=clock_timestamp()
    OR EXISTS (SELECT 1 FROM public.beck_ad_payment_receipts p
               WHERE p.reservation_id=p_reservation_id)
 THEN RAISE EXCEPTION 'unreleasable_or_paid_checkout' USING ERRCODE='P0001'; END IF;
 INSERT INTO public.beck_ad_checkout_releases
  (reservation_id,checkout_session_id,provider_status,provider_payment_status,
   reconciliation_sha256,provider_checked_at)
 VALUES (p_reservation_id,p_checkout_session_id,p_status,p_payment_status,
         p_sha256,p_checked_at) RETURNING * INTO receipt;
 UPDATE public.beck_ad_reservations
 SET status='EXPIRED',updated_at=clock_timestamp() WHERE reservation_id=p_reservation_id;
 RETURN receipt;
END $$;
REVOKE ALL ON FUNCTION public.beck_ad_release_expired_checkout(uuid,text,text,text,text,timestamptz)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.beck_ad_release_expired_checkout(uuid,text,text,text,text,timestamptz)
 TO service_role;
COMMIT;
