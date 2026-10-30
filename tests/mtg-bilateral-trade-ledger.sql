-- Read-only fixture in ephemeral GitHub Actions PostgreSQL.
-- The parent runner wraps migration and test in BEGIN/ROLLBACK.
DO $mtg_test$
DECLARE
 a text := 'u_' || repeat('a',24);
 b text := 'u_' || repeat('b',24);
 c text := 'u_' || repeat('c',24);
 terms jsonb := '{"schema":"dreamledger/mtg-trade-terms/v1","silo":"dreamledger-mtg","party_a_gives":[{"name":"Sol Ring","set":"CMM","collector_number":"395","condition":"NM","finish":"nonfoil","quantity":1,"photo_sha256":[]}],"party_b_gives":[{"name":"Arcane Signet","set":"CMM","collector_number":"398","condition":"NM","finish":"nonfoil","quantity":1,"photo_sha256":[]}],"handoff":"tracked_shipping","cash_minor":0,"currency":"NZD","notes":"Test only","platform_fee_minor":0,"external_fees_not_included":true}'::jsonb;
 proposal jsonb;
 receipt jsonb;
 trade uuid;
 h text;
 blocked boolean;
BEGIN
 proposal:=marketplace.mtg_trade_propose(a,b,terms,'testkey-0000000001');
 trade:=(proposal->>'trade_id')::uuid;
 h:=proposal->>'terms_sha256';
 IF proposal->>'state'<>'proposed' OR h !~ '^[a-f0-9]{64}$' THEN
   RAISE EXCEPTION 'PROPOSAL_INVALID';
 END IF;
 receipt:=marketplace.mtg_trade_propose(a,b,terms,'testkey-0000000001');
 IF receipt->>'replayed'<>'true' OR receipt->>'trade_id'<>trade::text THEN
   RAISE EXCEPTION 'PROPOSAL_REPLAY_FAILED';
 END IF;
 receipt:=marketplace.mtg_trade_act(a,trade,'accept',h,'testkey-0000000002');
 IF receipt->>'state'<>'proposed' THEN RAISE EXCEPTION 'PREMATURE_AGREEMENT'; END IF;
 receipt:=marketplace.mtg_trade_act(b,trade,'accept',h,'testkey-0000000003');
 IF receipt->>'state'<>'agreed' THEN RAISE EXCEPTION 'SECOND_SIGNATURE_MISSING'; END IF;
 receipt:=marketplace.mtg_trade_receipt(a,trade);
 IF receipt->>'party_a_accepted'<>'true' OR receipt->>'party_b_accepted'<>'true'
   OR jsonb_array_length(receipt->'events')<>3 THEN RAISE EXCEPTION 'INVALID_FINAL_RECEIPT'; END IF;
 blocked:=false;
 BEGIN
   PERFORM marketplace.mtg_trade_receipt(c,trade);
 EXCEPTION WHEN SQLSTATE '42501' THEN blocked:=true;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'THIRD_PARTY_RECEIPT_LEAK'; END IF;
 blocked:=false;
 BEGIN
   PERFORM marketplace.mtg_trade_act(a,trade,'accept',h,'testkey-0000000004');
 EXCEPTION WHEN SQLSTATE '22023' THEN blocked:=true;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'DOUBLE_ACCEPTANCE_ALLOWED'; END IF;
 blocked:=false;
 BEGIN
   UPDATE marketplace.mtg_trade_events SET actor=c WHERE trade_id=trade AND seq=1;
 EXCEPTION WHEN SQLSTATE '55000' THEN blocked:=true;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'HISTORY_MUTATION_ALLOWED'; END IF;
 receipt:=marketplace.mtg_trade_act(b,trade,'dispute',h,'testkey-0000000005');
 IF receipt->>'state'<>'disputed' THEN RAISE EXCEPTION 'DISPUTE_DENIED'; END IF;
 RAISE NOTICE 'MTG_TWO_PARTY_RECEIPT_SQL_PASS (synthetic, rolled back)';
END
$mtg_test$;
