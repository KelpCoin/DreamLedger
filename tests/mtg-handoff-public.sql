-- Synthetic dual-party, shareable redacted receipt; outer transaction ROLLBACK.
DO $handoff$
DECLARE
 a text:='u_'||repeat('a',24);b text:='u_'||repeat('b',24);c text:='u_'||repeat('c',24);
 t jsonb:='{"schema":"dreamledger/mtg-trade-terms/v1","silo":"dreamledger-mtg","party_a_gives":[{"name":"Sol Ring","set":"CMM","collector_number":"395","condition":"NM","finish":"nonfoil","quantity":1,"photo_sha256":["ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"]}],"party_b_gives":[{"name":"Arcane Signet","set":"CMM","collector_number":"398","condition":"NM","finish":"nonfoil","quantity":1,"photo_sha256":[]}],"handoff":"tracked_shipping","cash_minor":0,"currency":"NZD","notes":"private test address do not leak","platform_fee_minor":0,"external_fees_not_included":true}'::jsonb;
 prop jsonb;receipt jsonb;public_receipt jsonb;id uuid;hash text;
 evidence text:=repeat('a',64);blocked boolean;
BEGIN
 prop:=marketplace.mtg_trade_propose(a,b,t,'handoff-proposal-00001');
 id:=(prop->>'trade_id')::uuid;hash:=prop->>'terms_sha256';
 PERFORM marketplace.mtg_trade_act(a,id,'accept',hash,'handoff-accept-aaa001');
 PERFORM marketplace.mtg_trade_act(b,id,'accept',hash,'handoff-accept-bbb001');
 IF marketplace.mtg_trade_public_receipt(id) IS NOT NULL THEN RAISE EXCEPTION 'PUBLIC_BEFORE_CONSENT'; END IF;
 blocked:=false;
 BEGIN
  PERFORM marketplace.mtg_trade_transition(a,id,'receive',hash,'handoff-early-receive',evidence);
 EXCEPTION WHEN SQLSTATE '22023' THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'RECEIVE_BEFORE_DISPATCH_ALLOWED'; END IF;
 receipt:=marketplace.mtg_trade_transition(a,id,'dispatch',hash,'handoff-dispatch-aaa',evidence);
 IF receipt->>'state'<>'in_transit' THEN RAISE EXCEPTION 'DISPATCH_DID_NOT_START_TRANSIT'; END IF;
 receipt:=marketplace.mtg_trade_transition(a,id,'dispatch',hash,'handoff-dispatch-aaa',evidence);
 IF receipt->>'replayed'<>'true' THEN RAISE EXCEPTION 'DISPATCH_IDEMPOTENCY_BROKEN'; END IF;
 blocked:=false;
 BEGIN
  PERFORM marketplace.mtg_trade_transition(a,id,'receive',hash,'handoff-self-receive',evidence);
 EXCEPTION WHEN SQLSTATE '22023' THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'SELF_RECEIPT_ALLOWED'; END IF;
 PERFORM marketplace.mtg_trade_transition(b,id,'dispatch',hash,'handoff-dispatch-bbb',evidence);
 receipt:=marketplace.mtg_trade_transition(a,id,'receive',hash,'handoff-receive-aaa',evidence);
 IF receipt->>'state'<>'in_transit' THEN RAISE EXCEPTION 'ONE_RECEIPT_COMPLETE'; END IF;
 receipt:=marketplace.mtg_trade_transition(b,id,'receive',hash,'handoff-receive-bbb',evidence);
 IF receipt->>'state'<>'completed' THEN RAISE EXCEPTION 'SECOND_RECEIPT_NOT_COMPLETE'; END IF;
 PERFORM marketplace.mtg_trade_transition(a,id,'publish',hash,'handoff-publish-aaa',NULL);
 IF marketplace.mtg_trade_public_receipt(id) IS NOT NULL THEN RAISE EXCEPTION 'ONE_CONSENT_PUBLIC_LEAK'; END IF;
 PERFORM marketplace.mtg_trade_transition(b,id,'publish',hash,'handoff-publish-bbb',NULL);
 public_receipt:=marketplace.mtg_trade_public_receipt(id);
 IF public_receipt->>'status'<>'completed' OR public_receipt->>'both_agreed'<>'true' OR
   public_receipt->>'terms_sha256'<>hash THEN RAISE EXCEPTION 'PUBLIC_RECEIPT_WRONG'; END IF;
 IF public_receipt::text LIKE '%private test address%' OR
   public_receipt::text LIKE '%u_aaaaaaaa%' OR
   public_receipt::text LIKE '%ffffffffffffffff%' THEN RAISE EXCEPTION 'PII_LEAK'; END IF;
 IF (public_receipt->>'independent_external_anchor')::boolean THEN RAISE EXCEPTION 'FALSE_EXTERNAL_ANCHOR'; END IF;
 PERFORM marketplace.mtg_trade_transition(a,id,'unpublish',hash,'handoff-unpublish-a',NULL);
 IF marketplace.mtg_trade_public_receipt(id) IS NOT NULL THEN RAISE EXCEPTION 'UNPUBLISH_NOT_HONOURED'; END IF;
 receipt:=marketplace.mtg_trade_transition(b,id,'dispute',hash,'handoff-dispute-bbb',NULL);
 IF receipt->>'state'<>'disputed' THEN RAISE EXCEPTION 'COMPLETED_DISPUTE_BLOCKED'; END IF;
 blocked:=false;
 BEGIN
  PERFORM marketplace.mtg_trade_transition(c,id,'publish',hash,'handoff-third-party',NULL);
 EXCEPTION WHEN SQLSTATE '42501' THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'THIRD_PARTY_PUBLIC_CONTROL'; END IF;
 RAISE NOTICE 'MTG_HANDOFF_PUBLIC_SQL_PASS (synthetic, rolled back)';
END
$handoff$;
