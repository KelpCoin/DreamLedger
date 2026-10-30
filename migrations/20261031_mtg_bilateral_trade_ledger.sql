-- MTG-only bilateral trade evidence. DRAFT MIGRATION: not executed on production.
-- Depends on marketplace schema and trusted signed-session API. Not a public proof of immutability.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS marketplace.mtg_trade_agreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  silo_id text NOT NULL DEFAULT 'dreamledger-mtg' CHECK (silo_id='dreamledger-mtg'),
  party_a text NOT NULL CHECK (party_a ~ '^u_[a-f0-9]{24}$'),
  party_b text NOT NULL CHECK (party_b ~ '^u_[a-f0-9]{24}$'),
  terms jsonb NOT NULL CHECK (jsonb_typeof(terms)='object' AND octet_length(terms::text)<=16000),
  terms_sha256 text NOT NULL CHECK (terms_sha256 ~ '^[a-f0-9]{64}$'),
  offer_key text NOT NULL CHECK (offer_key ~ '^[A-Za-z0-9_-]{16,128}$'),
  state text NOT NULL DEFAULT 'proposed' CHECK (state IN ('proposed','agreed','declined','disputed','cancelled')),
  party_a_accepted boolean NOT NULL DEFAULT false,
  party_b_accepted boolean NOT NULL DEFAULT false,
  seq integer NOT NULL DEFAULT 0,
  head_sha256 text NOT NULL DEFAULT repeat('0',64) CHECK (head_sha256 ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  agreed_at timestamptz,
  UNIQUE (party_a,offer_key),
  CHECK (party_a<>party_b),
  CHECK (state <> 'agreed' OR (party_a_accepted AND party_b_accepted))
);
CREATE INDEX IF NOT EXISTS mtg_trade_party_a ON marketplace.mtg_trade_agreements (party_a,created_at DESC);
CREATE INDEX IF NOT EXISTS mtg_trade_party_b ON marketplace.mtg_trade_agreements (party_b,created_at DESC);
CREATE TABLE IF NOT EXISTS marketplace.mtg_trade_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id uuid NOT NULL REFERENCES marketplace.mtg_trade_agreements(id),
  seq integer NOT NULL CHECK (seq>0),
  actor text NOT NULL,
  action text NOT NULL CHECK (action IN ('propose','accept','decline','cancel','dispute')),
  idempotency_key text NOT NULL CHECK (idempotency_key ~ '^[A-Za-z0-9_-]{16,128}$'),
  payload jsonb NOT NULL,
  previous_sha256 text NOT NULL CHECK (previous_sha256 ~ '^[a-f0-9]{64}$'),
  event_sha256 text NOT NULL CHECK (event_sha256 ~ '^[a-f0-9]{64}$'),
  happened_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (trade_id,seq),
  UNIQUE (trade_id,actor,idempotency_key)
);
CREATE INDEX IF NOT EXISTS mtg_trade_events_seq ON marketplace.mtg_trade_events(trade_id,seq);
CREATE OR REPLACE FUNCTION marketplace.reject_mtg_trade_event_mutation()
RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  RAISE EXCEPTION 'MTG_TRADE_LEDGER_APPEND_ONLY' USING ERRCODE='55000';
END; $fn$;
DROP TRIGGER IF EXISTS mtg_trade_events_no_update ON marketplace.mtg_trade_events;
CREATE TRIGGER mtg_trade_events_no_update BEFORE UPDATE OR DELETE
ON marketplace.mtg_trade_events FOR EACH ROW EXECUTE FUNCTION marketplace.reject_mtg_trade_event_mutation();
-- Direct DML denied; the vetted security-definer functions below own mutations.
REVOKE ALL ON marketplace.mtg_trade_agreements FROM PUBLIC;
REVOKE ALL ON marketplace.mtg_trade_events FROM PUBLIC;

CREATE OR REPLACE FUNCTION marketplace.mtg_trade_propose(
 p_actor text,p_other text,p_terms jsonb,p_key text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,marketplace AS $fn$
DECLARE t marketplace.mtg_trade_agreements%ROWTYPE;
DECLARE v_hash text; v_stamp timestamptz; v_payload jsonb; v_event_hash text;
BEGIN
  IF p_actor !~ '^u_[a-f0-9]{24}$' OR p_other !~ '^u_[a-f0-9]{24}$'
     OR p_actor=p_other OR p_key !~ '^[A-Za-z0-9_-]{16,128}$'
     OR jsonb_typeof(p_terms)<>'object' OR octet_length(p_terms::text)>16000 THEN
    RAISE EXCEPTION 'TRADE_INVALID' USING ERRCODE='22023';
  END IF;
  v_hash:=encode(pg_catalog.sha256(convert_to('DL-MTG-TERMS/v1:'||p_terms::text,'UTF8')),'hex');
  INSERT INTO marketplace.mtg_trade_agreements(party_a,party_b,terms,terms_sha256,offer_key)
  VALUES(p_actor,p_other,p_terms,v_hash,p_key)
  ON CONFLICT (party_a,offer_key) DO NOTHING RETURNING * INTO t;
  IF NOT FOUND THEN
    SELECT * INTO t FROM marketplace.mtg_trade_agreements WHERE party_a=p_actor AND offer_key=p_key;
    IF t.id IS NULL OR t.party_b<>p_other OR t.terms_sha256<>v_hash THEN
      RAISE EXCEPTION 'TRADE_IDEMPOTENCY_CONFLICT' USING ERRCODE='23505';
    END IF;
    RETURN jsonb_build_object('trade_id',t.id,'state',t.state,'terms_sha256',t.terms_sha256,'replayed',true);
  END IF;
  v_stamp:=clock_timestamp();
  v_payload:=jsonb_build_object('trade_id',t.id,'seq',1,'action','propose','actor',p_actor,
     'terms_sha256',v_hash,'previous_sha256',repeat('0',64),'at_utc',to_char(v_stamp AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'));
  v_event_hash:=encode(pg_catalog.sha256(convert_to('DL-MTG-EVENT/v1:'||v_payload::text,'UTF8')),'hex');
  INSERT INTO marketplace.mtg_trade_events(trade_id,seq,actor,action,idempotency_key,payload,previous_sha256,event_sha256,happened_at)
    VALUES(t.id,1,p_actor,'propose',p_key,v_payload,repeat('0',64),v_event_hash,v_stamp);
  UPDATE marketplace.mtg_trade_agreements SET seq=1,head_sha256=v_event_hash WHERE id=t.id;
  RETURN jsonb_build_object('trade_id',t.id,'state','proposed','terms_sha256',v_hash,'head_sha256',v_event_hash,'replayed',false);
END; $fn$;

CREATE OR REPLACE FUNCTION marketplace.mtg_trade_act(
 p_actor text,p_trade uuid,p_action text,p_terms_sha256 text,p_key text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,marketplace AS $fn$
DECLARE t marketplace.mtg_trade_agreements%ROWTYPE;
DECLARE existing marketplace.mtg_trade_events%ROWTYPE;
DECLARE v_stamp timestamptz;v_payload jsonb;v_event_hash text;
DECLARE v_a boolean;v_b boolean;v_state text;
BEGIN
  IF p_actor !~ '^u_[a-f0-9]{24}$' OR p_key !~ '^[A-Za-z0-9_-]{16,128}$'
    OR p_terms_sha256 !~ '^[a-f0-9]{64}$'
    OR p_action NOT IN ('accept','decline','cancel','dispute') THEN
    RAISE EXCEPTION 'TRADE_INVALID' USING ERRCODE='22023';
  END IF;
  SELECT * INTO t FROM marketplace.mtg_trade_agreements WHERE id=p_trade FOR UPDATE;
  IF t.id IS NULL OR p_actor NOT IN (t.party_a,t.party_b)
    THEN RAISE EXCEPTION 'TRADE_NOT_FOUND' USING ERRCODE='42501'; END IF;
  -- Exactly the same immutable terms must be displayed/accepted by both parties.
  IF t.terms_sha256<>p_terms_sha256
    THEN RAISE EXCEPTION 'TRADE_TERMS_CHANGED' USING ERRCODE='22023'; END IF;
  SELECT * INTO existing FROM marketplace.mtg_trade_events
   WHERE trade_id=p_trade AND actor=p_actor AND idempotency_key=p_key;
  IF existing.id IS NOT NULL THEN
    IF existing.action<>p_action THEN
      RAISE EXCEPTION 'TRADE_IDEMPOTENCY_CONFLICT' USING ERRCODE='23505';
    END IF;
    RETURN jsonb_build_object('trade_id',t.id,'state',t.state,'terms_sha256',t.terms_sha256,'head_sha256',t.head_sha256,'replayed',true);
  END IF;
  IF p_action='accept' AND (t.state<>'proposed'
     OR (p_actor=t.party_a AND t.party_a_accepted)
     OR (p_actor=t.party_b AND t.party_b_accepted)) THEN
     RAISE EXCEPTION 'TRADE_STATE_CONFLICT' USING ERRCODE='22023';
  END IF;
  IF p_action='cancel' AND (t.state<>'proposed' OR p_actor<>t.party_a)
    THEN RAISE EXCEPTION 'TRADE_STATE_CONFLICT' USING ERRCODE='22023'; END IF;
  IF p_action='decline' AND t.state<>'proposed'
    THEN RAISE EXCEPTION 'TRADE_STATE_CONFLICT' USING ERRCODE='22023'; END IF;
  IF p_action='dispute' AND t.state NOT IN ('proposed','agreed')
    THEN RAISE EXCEPTION 'TRADE_STATE_CONFLICT' USING ERRCODE='22023'; END IF;
  v_a:=t.party_a_accepted OR (p_action='accept' AND p_actor=t.party_a);
  v_b:=t.party_b_accepted OR (p_action='accept' AND p_actor=t.party_b);
  v_state:=CASE
    WHEN p_action='dispute' THEN 'disputed'
    WHEN p_action='decline' THEN 'declined'
    WHEN p_action='cancel' THEN 'cancelled'
    WHEN v_a AND v_b THEN 'agreed'
    ELSE 'proposed' END;
  v_stamp:=clock_timestamp();
  v_payload:=jsonb_build_object('trade_id',t.id,'seq',t.seq+1,'action',p_action,'actor',p_actor,
     'terms_sha256',t.terms_sha256,'previous_sha256',t.head_sha256,
     'at_utc',to_char(v_stamp AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'));
  v_event_hash:=encode(pg_catalog.sha256(convert_to('DL-MTG-EVENT/v1:'||v_payload::text,'UTF8')),'hex');
  INSERT INTO marketplace.mtg_trade_events(trade_id,seq,actor,action,idempotency_key,payload,previous_sha256,event_sha256,happened_at)
    VALUES(t.id,t.seq+1,p_actor,p_action,p_key,v_payload,t.head_sha256,v_event_hash,v_stamp);
  UPDATE marketplace.mtg_trade_agreements
    SET seq=t.seq+1,head_sha256=v_event_hash,party_a_accepted=v_a,party_b_accepted=v_b,
      state=v_state,agreed_at=CASE WHEN v_state='agreed' THEN v_stamp ELSE t.agreed_at END
    WHERE id=t.id;
  RETURN jsonb_build_object('trade_id',t.id,'state',v_state,'terms_sha256',t.terms_sha256,'head_sha256',v_event_hash,'replayed',false);
END; $fn$;

CREATE OR REPLACE FUNCTION marketplace.mtg_trade_receipt(p_actor text,p_trade uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,marketplace AS $fn$
DECLARE t marketplace.mtg_trade_agreements%ROWTYPE; v_events jsonb;
BEGIN
  IF p_actor !~ '^u_[a-f0-9]{24}$' THEN RAISE EXCEPTION 'INVALID_IDENTITY' USING ERRCODE='42501'; END IF;
  SELECT * INTO t FROM marketplace.mtg_trade_agreements WHERE id=p_trade;
  IF t.id IS NULL OR p_actor NOT IN (t.party_a,t.party_b) THEN
    RAISE EXCEPTION 'TRADE_NOT_FOUND' USING ERRCODE='42501';
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('seq',e.seq,'actor',e.actor,'action',e.action,
     'payload',e.payload,'previous_sha256',e.previous_sha256,'event_sha256',e.event_sha256)
     ORDER BY e.seq),'[]'::jsonb) INTO v_events
   FROM marketplace.mtg_trade_events e WHERE e.trade_id=t.id;
  RETURN jsonb_build_object('schema','dreamledger/mtg-trade-receipt/v1','trade_id',t.id,
    'silo','dreamledger-mtg','party_a',t.party_a,'party_b',t.party_b,
    'terms',t.terms,'terms_sha256',t.terms_sha256,'state',t.state,'party_a_accepted',t.party_a_accepted,
    'party_b_accepted',t.party_b_accepted,'agreed_at',t.agreed_at,
    'head_sha256',t.head_sha256,'events',v_events,'provider_payment_verified',false,
    'fulfilment_verified',false,'legal_disputes_permitted',true);
END; $fn$;
REVOKE ALL ON FUNCTION marketplace.mtg_trade_propose(text,text,jsonb,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION marketplace.mtg_trade_act(text,uuid,text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION marketplace.mtg_trade_receipt(text,uuid) FROM PUBLIC;
-- Provisioning prerequisite: migration owner MUST differ from the non-BYPASSRLS app role.
-- Grant only EXECUTE on these three routines to the already-provisioned, audited app role
-- in the controlled environment, never to PUBLIC or anon.
COMMENT ON TABLE marketplace.mtg_trade_events IS
'Append-only hash-chained consent evidence, not WORM storage or a bar to legal disputes.';
