-- Additive MTG trade handoff + opt-in public receipt, DRAFT ONLY.
-- Must be run after 20261031_mtg_bilateral_trade_ledger.sql by a separated migration owner.
ALTER TABLE marketplace.mtg_trade_agreements
  DROP CONSTRAINT IF EXISTS mtg_trade_agreements_state_check;
ALTER TABLE marketplace.mtg_trade_agreements
  ADD CONSTRAINT mtg_trade_agreements_state_check
  CHECK (state IN ('proposed','agreed','in_transit','completed','declined','disputed','cancelled'));
ALTER TABLE marketplace.mtg_trade_events
  DROP CONSTRAINT IF EXISTS mtg_trade_events_action_check;
ALTER TABLE marketplace.mtg_trade_events
  ADD CONSTRAINT mtg_trade_events_action_check
  CHECK (action IN ('propose','accept','decline','cancel','dispute','dispatch','receive','publish','unpublish'));
ALTER TABLE marketplace.mtg_trade_agreements
  ADD COLUMN IF NOT EXISTS dispatched_a boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dispatched_b boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS received_a boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS received_b boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS share_a boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS share_b boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

CREATE OR REPLACE FUNCTION marketplace.mtg_trade_transition(
 p_actor text,p_trade uuid,p_action text,p_terms_sha256 text,p_key text,p_evidence_sha256 text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,marketplace AS $mtg$
DECLARE t marketplace.mtg_trade_agreements%ROWTYPE;
DECLARE old_event marketplace.mtg_trade_events%ROWTYPE;
DECLARE a_dis boolean; b_dis boolean; a_rec boolean; b_rec boolean;
DECLARE a_share boolean; b_share boolean; next_state text;
DECLARE stamp timestamptz; payload jsonb; new_hash text; ev_hash text;
BEGIN
 IF p_actor !~ '^u_[a-f0-9]{24}$' OR p_terms_sha256 !~ '^[a-f0-9]{64}$'
   OR p_key !~ '^[A-Za-z0-9_-]{16,128}$'
   OR p_action NOT IN ('dispatch','receive','publish','unpublish','dispute')
 THEN RAISE EXCEPTION 'TRADE_INVALID' USING ERRCODE='22023'; END IF;
 IF p_action IN ('dispatch','receive') AND (p_evidence_sha256 IS NULL OR p_evidence_sha256 !~ '^[a-f0-9]{64}$')
 THEN RAISE EXCEPTION 'HANDOFF_EVIDENCE_REQUIRED' USING ERRCODE='22023'; END IF;
 IF p_action NOT IN ('dispatch','receive') AND p_evidence_sha256 IS NOT NULL
 THEN RAISE EXCEPTION 'UNEXPECTED_EVIDENCE' USING ERRCODE='22023'; END IF;
 SELECT * INTO t FROM marketplace.mtg_trade_agreements WHERE id=p_trade FOR UPDATE;
 IF t.id IS NULL OR p_actor NOT IN (t.party_a,t.party_b)
 THEN RAISE EXCEPTION 'TRADE_NOT_FOUND' USING ERRCODE='42501'; END IF;
 IF t.terms_sha256<>p_terms_sha256
 THEN RAISE EXCEPTION 'TRADE_TERMS_CHANGED' USING ERRCODE='22023'; END IF;
 SELECT * INTO old_event FROM marketplace.mtg_trade_events
  WHERE trade_id=p_trade AND actor=p_actor AND idempotency_key=p_key;
 IF old_event.id IS NOT NULL THEN
   IF old_event.action<>p_action OR coalesce(old_event.payload->>'evidence_sha256','')<>coalesce(p_evidence_sha256,'')
   THEN RAISE EXCEPTION 'TRADE_IDEMPOTENCY_CONFLICT' USING ERRCODE='23505'; END IF;
   RETURN jsonb_build_object('trade_id',t.id,'state',t.state,'head_sha256',t.head_sha256,'replayed',true);
 END IF;
 a_dis:=t.dispatched_a;b_dis:=t.dispatched_b;
 a_rec:=t.received_a;b_rec:=t.received_b;
 a_share:=t.share_a;b_share:=t.share_b;
 next_state:=t.state;
 IF p_action='dispatch' THEN
   IF t.state NOT IN ('agreed','in_transit') OR
      (p_actor=t.party_a AND a_dis) OR (p_actor=t.party_b AND b_dis)
   THEN RAISE EXCEPTION 'TRADE_STATE_CONFLICT' USING ERRCODE='22023'; END IF;
   IF p_actor=t.party_a THEN a_dis:=true; ELSE b_dis:=true; END IF;
   next_state:='in_transit';
 ELSIF p_action='receive' THEN
   IF t.state<>'in_transit' OR
      (p_actor=t.party_a AND (a_rec OR NOT b_dis)) OR
      (p_actor=t.party_b AND (b_rec OR NOT a_dis))
   THEN RAISE EXCEPTION 'TRADE_STATE_CONFLICT' USING ERRCODE='22023'; END IF;
   IF p_actor=t.party_a THEN a_rec:=true; ELSE b_rec:=true; END IF;
   IF a_rec AND b_rec THEN next_state:='completed'; END IF;
 ELSIF p_action='publish' THEN
   IF t.state NOT IN ('agreed','in_transit','completed','disputed') OR
      (p_actor=t.party_a AND a_share) OR (p_actor=t.party_b AND b_share)
   THEN RAISE EXCEPTION 'TRADE_STATE_CONFLICT' USING ERRCODE='22023'; END IF;
   IF p_actor=t.party_a THEN a_share:=true; ELSE b_share:=true; END IF;
 ELSIF p_action='unpublish' THEN
   IF (p_actor=t.party_a AND NOT a_share) OR (p_actor=t.party_b AND NOT b_share)
   THEN RAISE EXCEPTION 'TRADE_STATE_CONFLICT' USING ERRCODE='22023'; END IF;
   IF p_actor=t.party_a THEN a_share:=false; ELSE b_share:=false; END IF;
 ELSIF p_action='dispute' THEN
   IF t.state NOT IN ('agreed','in_transit','completed')
   THEN RAISE EXCEPTION 'TRADE_STATE_CONFLICT' USING ERRCODE='22023'; END IF;
   next_state:='disputed';
 END IF;
 stamp:=clock_timestamp();
 payload:=jsonb_build_object('trade_id',t.id,'seq',t.seq+1,'actor',p_actor,'action',p_action,
   'terms_sha256',t.terms_sha256,'evidence_sha256',p_evidence_sha256,
   'previous_sha256',t.head_sha256,'at_utc',
   to_char(stamp AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'));
 ev_hash:=encode(pg_catalog.sha256(convert_to('DL-MTG-EVENT/v1:'||payload::text,'UTF8')),'hex');
 INSERT INTO marketplace.mtg_trade_events(
  trade_id,seq,actor,action,idempotency_key,payload,previous_sha256,event_sha256,happened_at)
 VALUES(t.id,t.seq+1,p_actor,p_action,p_key,payload,t.head_sha256,ev_hash,stamp);
 UPDATE marketplace.mtg_trade_agreements
 SET seq=t.seq+1,head_sha256=ev_hash,state=next_state,
  dispatched_a=a_dis,dispatched_b=b_dis,received_a=a_rec,received_b=b_rec,
  share_a=a_share,share_b=b_share,
  completed_at=CASE WHEN next_state='completed' AND t.completed_at IS NULL THEN stamp ELSE t.completed_at END
 WHERE id=t.id;
 RETURN jsonb_build_object('trade_id',t.id,'state',next_state,'terms_sha256',t.terms_sha256,
  'head_sha256',ev_hash,'dispatched_a',a_dis,'dispatched_b',b_dis,
  'received_a',a_rec,'received_b',b_rec,'public_receipt_enabled',a_share AND b_share,'replayed',false);
END; $mtg$;

-- Privacy: only show public receipt following explicit consent from BOTH participants.
-- No account identifiers, private notes, addresses, photos, hashes of private photos, or transaction secrets.
CREATE OR REPLACE FUNCTION marketplace.mtg_trade_public_receipt(p_trade uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,marketplace AS $mtg$
DECLARE t marketplace.mtg_trade_agreements%ROWTYPE;
DECLARE a_cards jsonb; b_cards jsonb;
BEGIN
 SELECT * INTO t FROM marketplace.mtg_trade_agreements
  WHERE id=p_trade AND share_a AND share_b AND party_a_accepted AND party_b_accepted
  AND state IN ('agreed','in_transit','completed','disputed');
 IF t.id IS NULL THEN RETURN NULL; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object(
   'name',x.value->>'name','set',x.value->>'set',
   'collector_number',x.value->>'collector_number','condition',x.value->>'condition',
   'finish',x.value->>'finish','quantity',(x.value->>'quantity')::integer)
   ORDER BY x.ordinality),'[]'::jsonb) INTO a_cards
 FROM jsonb_array_elements(t.terms->'party_a_gives') WITH ORDINALITY x(value,ordinality);
 SELECT coalesce(jsonb_agg(jsonb_build_object(
   'name',x.value->>'name','set',x.value->>'set',
   'collector_number',x.value->>'collector_number','condition',x.value->>'condition',
   'finish',x.value->>'finish','quantity',(x.value->>'quantity')::integer)
   ORDER BY x.ordinality),'[]'::jsonb) INTO b_cards
 FROM jsonb_array_elements(t.terms->'party_b_gives') WITH ORDINALITY x(value,ordinality);
 RETURN jsonb_build_object(
  'schema','dreamledger/mtg-trade-public-receipt/v1',
  'trade_id',t.id,'silo','dreamledger-mtg','status',t.state,
  'party_a_label','Trader A','party_b_label','Trader B',
  'both_agreed',t.party_a_accepted AND t.party_b_accepted,
  'agreed_at_utc',t.agreed_at,'completed_at_utc',t.completed_at,
  'dispatched_a',t.dispatched_a,'dispatched_b',t.dispatched_b,
  'received_a',t.received_a,'received_b',t.received_b,
  'party_a_gives',a_cards,'party_b_gives',b_cards,
  'cash_minor',t.terms->'cash_minor','currency','NZD','handoff',t.terms->>'handoff',
  'terms_sha256',t.terms_sha256,'latest_event_sha256',t.head_sha256,
  'event_count',t.seq,'provider_payment_verified',false,'independent_external_anchor',false,
  'evidence_is_tamper_evident_not_legal_finality',true
 );
END; $mtg$;
REVOKE ALL ON FUNCTION marketplace.mtg_trade_transition(text,uuid,text,text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION marketplace.mtg_trade_public_receipt(uuid) FROM PUBLIC;
COMMENT ON FUNCTION marketplace.mtg_trade_public_receipt(uuid) IS
'An explicitly dual-opt-in public projection, not a certificate of lawful title, payment or delivery.';
