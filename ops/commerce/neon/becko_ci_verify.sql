-- CI-ONLY disposable PostgreSQL 16 integration tests. NEVER against production.
\set ON_ERROR_STOP on
DO $test$
DECLARE
  v_key text; v_claim record; v_second record; v_failed boolean;
  v_before integer;
BEGIN
  -- Canonical accepted transaction creates ALL records, not just a payment.
  SELECT public.becko_accept_checkout_v1(
    'evt_becko_001','checkout.session.completed',repeat('a',64),
    'cs_live_becko_001','pi_becko_001','offer-mtg-test',2500,'NZD','mtg',
    'artifact:becko-001',true) INTO v_key;
  IF v_key <> 'stripe_delivery:cs_live_becko_001' THEN
    RAISE EXCEPTION 'BAD_DELIVERY_KEY';
  END IF;
  PERFORM public.becko_accept_checkout_v1(
    'evt_becko_001','checkout.session.completed',repeat('a',64),
    'cs_live_becko_001','pi_becko_001','offer-mtg-test',2500,'NZD','mtg',
    'artifact:becko-001',true);
  -- New event, same paid session. Both inbox rows, one paid order/outbox.
  PERFORM public.becko_accept_checkout_v1(
    'evt_becko_002','checkout.session.async_payment_succeeded',repeat('b',64),
    'cs_live_becko_001','pi_becko_001','offer-mtg-test',2500,'NZD','mtg',
    'artifact:becko-001',true);
  IF (SELECT count(*) FROM public.stripe_event_inbox) <> 2
     OR (SELECT count(*) FROM public.commercial_orders) <> 1
     OR (SELECT count(*) FROM public.commercial_payments) <> 1
     OR (SELECT count(*) FROM public.commercial_fulfillment_outbox) <> 1
  THEN RAISE EXCEPTION 'DUPLICATE_OR_MISSING_ATOMIC_WRITES'; END IF;
  IF (SELECT status FROM public.commercial_fulfillment_outbox WHERE delivery_key=v_key)<>'PENDING'
    THEN RAISE EXCEPTION 'JOB_NOT_PENDING'; END IF;

  -- Cross-silo mismatch, price drift, and fake/unpaid envelope refuse.
  v_failed:=false;
  BEGIN
    PERFORM public.becko_accept_checkout_v1(
      'evt_becko_bad1','checkout.session.completed',repeat('b',64),
      'cs_live_becko_bad1','pi_becko_bad1','offer-adult-test',700,'NZD','mtg','file:x',true);
  EXCEPTION WHEN raise_exception THEN v_failed:=true; END;
  IF NOT v_failed THEN RAISE EXCEPTION 'CROSS_SILO_ACCEPTED'; END IF;
  v_failed:=false;
  BEGIN
    PERFORM public.becko_accept_checkout_v1(
      'evt_becko_bad2','checkout.session.completed',repeat('b',64),
      'cs_live_becko_bad2','pi_becko_bad2','offer-mtg-test',2499,'NZD','mtg','file:x',true);
  EXCEPTION WHEN raise_exception THEN v_failed:=true; END;
  IF NOT v_failed THEN RAISE EXCEPTION 'PRICE_DRIFT_ACCEPTED'; END IF;
  v_failed:=false;
  BEGIN
    PERFORM public.becko_accept_checkout_v1(
      'evt_becko_bad3','checkout.session.completed',repeat('b',64),
      'cs_live_becko_bad3','pi_becko_bad3','offer-mtg-test',2500,'NZD','mtg','file:x',false);
  EXCEPTION WHEN raise_exception THEN v_failed:=true; END;
  IF NOT v_failed THEN RAISE EXCEPTION 'FAKE_LIVEMODE_ACCEPTED'; END IF;
  IF (SELECT count(*) FROM public.commercial_orders) <> 1
    THEN RAISE EXCEPTION 'REFUSAL_MUTATED_ORDERS'; END IF;

  -- One active owner at a time; expired owner cannot finalize.
  SELECT * INTO v_claim FROM public.becko_claim_v1('worker-one',1,3,30);
  IF v_claim.delivery_key IS DISTINCT FROM v_key OR v_claim.attempts <> 1
    THEN RAISE EXCEPTION 'BAD_FIRST_CLAIM'; END IF;
  SELECT * INTO v_second FROM public.becko_claim_v1('worker-two',1,3,30);
  IF FOUND THEN RAISE EXCEPTION 'DOUBLE_CLAIM'; END IF;
  UPDATE public.commercial_fulfillment_outbox
    SET leased_until=now()-interval '1 second' WHERE delivery_key=v_key;
  SELECT * INTO v_second FROM public.becko_claim_v1('worker-two',1,3,30);
  IF v_second.lease_token IS NULL OR v_second.lease_token=v_claim.lease_token
     OR v_second.attempts <> 2
  THEN RAISE EXCEPTION 'LEASE_RECOVERY_FAILED'; END IF;
  v_failed:=false;
  BEGIN
    PERFORM public.becko_confirm_v1(v_key,'worker-one',v_claim.lease_token,repeat('c',64));
  EXCEPTION WHEN raise_exception THEN v_failed:=true; END;
  IF NOT v_failed THEN RAISE EXCEPTION 'STALE_OWNER_CAN_FINALIZE'; END IF;
  PERFORM public.becko_confirm_v1(v_key,'worker-two',v_second.lease_token,repeat('d',64));
  IF (SELECT status FROM public.commercial_fulfillment_outbox WHERE delivery_key=v_key)<>'DELIVERED'
    OR (SELECT receipt_sha256 FROM public.commercial_fulfillment_outbox WHERE delivery_key=v_key)<>repeat('d',64)
  THEN RAISE EXCEPTION 'FINALIZE_NOT_FENCED'; END IF;

  -- Separate job retries bounded by max attempts.
  PERFORM public.becko_accept_checkout_v1(
    'evt_becko_003','checkout.session.completed',repeat('a',64),
    'cs_live_becko_003','pi_becko_003','offer-mtg-test',2500,'NZD','mtg','file:003',true);
  SELECT * INTO v_claim FROM public.becko_claim_v1('worker-three',1,2,30);
  IF v_claim.delivery_key <> 'stripe_delivery:cs_live_becko_003'
    THEN RAISE EXCEPTION 'CLAIMED_WRONG_JOB'; END IF;
  IF public.becko_retry_v1(v_claim.delivery_key,'worker-three',v_claim.lease_token,'CI_TRANSIENT',2)<>'PENDING'
    THEN RAISE EXCEPTION 'RETRY_FAILED'; END IF;
  UPDATE public.commercial_fulfillment_outbox
    SET next_attempt_at=now()-interval '1 second' WHERE delivery_key=v_claim.delivery_key;
  SELECT * INTO v_second FROM public.becko_claim_v1('worker-four',1,2,30);
  IF v_second.attempts<>2 THEN RAISE EXCEPTION 'ATTEMPT_NOT_INCREMENTED'; END IF;
  IF public.becko_retry_v1(v_second.delivery_key,'worker-four',v_second.lease_token,'CI_FINAL',2)<>'FAILED_REVIEW'
    THEN RAISE EXCEPTION 'DEAD_LETTER_NOT_REACHED'; END IF;
  SELECT * INTO v_second FROM public.becko_claim_v1('worker-five',1,2,30);
  IF FOUND THEN RAISE EXCEPTION 'DEAD_LETTER_RECLAIMED'; END IF;
END
$test$;

-- Inject a DB failure at the EXACT outbox insert boundary. Every prior write
-- in beck_accept_checkout_v1 must roll back, including the event inbox row.
CREATE FUNCTION public.becko_ci_fail_outbox() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'BECKO_CI_OUTBOX_DOWN'; END; $$;
CREATE TRIGGER becko_ci_fail_outbox BEFORE INSERT ON public.commercial_fulfillment_outbox
FOR EACH ROW EXECUTE FUNCTION public.becko_ci_fail_outbox();
DO $test$
DECLARE v_failed boolean:=false;
BEGIN
  BEGIN
    PERFORM public.becko_accept_checkout_v1(
      'evt_becko_rollback','checkout.session.completed',repeat('f',64),
      'cs_live_becko_rollback','pi_becko_rollback','offer-mtg-test',2500,'NZD','mtg','file:rollback',true);
  EXCEPTION WHEN raise_exception THEN v_failed:=true; END;
  IF NOT v_failed THEN RAISE EXCEPTION 'OUTBOX_FAILURE_NOT_PROPAGATED'; END IF;
  IF EXISTS(SELECT 1 FROM public.stripe_event_inbox WHERE event_id='evt_becko_rollback')
    OR EXISTS(SELECT 1 FROM public.commercial_orders WHERE stripe_checkout_session_id='cs_live_becko_rollback')
    OR EXISTS(SELECT 1 FROM public.commercial_payments WHERE stripe_payment_intent_id='pi_becko_rollback')
  THEN RAISE EXCEPTION 'PAYMENT_COMMITTED_WITHOUT_OUTBOX'; END IF;
END $test$;
DROP TRIGGER becko_ci_fail_outbox ON public.commercial_fulfillment_outbox;
DROP FUNCTION public.becko_ci_fail_outbox();

DO $test$ BEGIN
IF has_function_privilege('becko_untrusted',
    'public.becko_accept_checkout_v1(text,text,text,text,text,text,integer,text,text,text,boolean)','EXECUTE')
THEN RAISE EXCEPTION 'PUBLIC_EXECUTE_NOT_REVOKED'; END IF;
END $test$;
SELECT 'BECKO_POSTGRES_INTEGRATION=PASS_SYNTHETIC_NO_REAL_PAYMENT' AS proof;
