-- CUBE v2: cross-domain policy and inventory trust boundaries.
-- Additive staging migration; no public publication or sale is authorized.
CREATE TABLE IF NOT EXISTS marketplace.silo_contracts (
  silo_id text PRIMARY KEY CHECK (silo_id ~ '^[a-z0-9-]{2,48}$'),
  display_name text NOT NULL CHECK (length(display_name) BETWEEN 2 AND 120),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  locale text NOT NULL CHECK (length(locale) BETWEEN 2 AND 32),
  inventory_mode text NOT NULL CHECK (inventory_mode IN ('physical','digital','service','mixed')),
  payment_provider text NOT NULL CHECK (payment_provider IN ('stripe','external','none')),
  peer_fee_basis_points integer NOT NULL DEFAULT 0 CHECK (peer_fee_basis_points BETWEEN 0 AND 10000),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','review','active','suspended')),
  brand jsonb NOT NULL DEFAULT '{}'::jsonb,
  domain_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  legal_pack jsonb NOT NULL DEFAULT '{}'::jsonb,
  publication_approved_at timestamptz,
  legal_review_approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT silo_approved_activation CHECK (status <> 'active' OR
    (publication_approved_at IS NOT NULL AND legal_review_approved_at IS NOT NULL
    AND length(coalesce(legal_pack->>'policy_version','')) > 0
    AND length(coalesce(legal_pack->>'jurisdiction','')) > 0))
);
COMMENT ON TABLE marketplace.silo_contracts IS
 'Domain configuration and activation gates, not inventory or payment proof. Never seed as active via clone.';

CREATE TABLE IF NOT EXISTS marketplace.supply_attestations (
  listing_id uuid PRIMARY KEY REFERENCES marketplace.listings(id),
  silo_id text NOT NULL REFERENCES marketplace.silo_contracts(silo_id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','revoked')),
  verified_quantity integer NOT NULL DEFAULT 0 CHECK (verified_quantity >= 0),
  evidence_sha256 text CHECK (evidence_sha256 ~ '^[a-f0-9]{64}$'),
  verified_by text,
  verified_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT supply_verified_has_evidence CHECK (status <> 'verified' OR
   (verified_quantity > 0 AND evidence_sha256 IS NOT NULL
    AND length(coalesce(verified_by,'')) >= 6
    AND verified_at IS NOT NULL AND expires_at IS NOT NULL
    AND expires_at > verified_at))
);
COMMENT ON TABLE marketplace.supply_attestations IS
 'Independent trusted supply evidence for any silo; a SHA-256 format alone does not verify real-world stock. Writes restricted to dedicated verifier.';

CREATE INDEX IF NOT EXISTS supply_attestations_by_silo
 ON marketplace.supply_attestations(silo_id, status, expires_at);
CREATE INDEX IF NOT EXISTS cube_listings_by_silo
 ON marketplace.listings(silo_id, status, published_at DESC);

-- Public application role can read policy and attested stock, not impersonate a verifier.
REVOKE ALL ON marketplace.silo_contracts FROM PUBLIC;
REVOKE ALL ON marketplace.supply_attestations FROM PUBLIC;
REVOKE ALL ON marketplace.silo_contracts FROM dreamledger_app;
REVOKE ALL ON marketplace.supply_attestations FROM dreamledger_app;
GRANT SELECT ON marketplace.silo_contracts TO dreamledger_app;
GRANT SELECT ON marketplace.supply_attestations TO dreamledger_app;

-- Add a v2 generic reservation operation. Leave legacy v1 unchanged.
-- This does NOT initiate Stripe checkout, settlement or fulfillment.
CREATE FUNCTION marketplace.reserve_stock_v2(
 p_listing_id uuid, p_buyer_principal_id text, p_idempotency_key text,
 p_quantity integer DEFAULT 1, p_hold_minutes integer DEFAULT 30
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER
SET search_path = marketplace, pg_catalog
AS $fn$
DECLARE prior marketplace.stock_reservations%ROWTYPE;
  reservation_id uuid; remaining integer;
BEGIN
 IF p_buyer_principal_id IS NULL OR length(p_buyer_principal_id) NOT BETWEEN 6 AND 128
 OR p_idempotency_key IS NULL OR p_idempotency_key !~ '^[A-Za-z0-9_-]{16,128}$'
 OR p_quantity IS NULL OR p_quantity NOT BETWEEN 1 AND 10
 OR p_hold_minutes IS NULL OR p_hold_minutes NOT BETWEEN 5 AND 60 THEN
  RAISE EXCEPTION 'INVALID_RESERVATION_INPUT' USING ERRCODE='22023';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_idempotency_key,0));
 SELECT * INTO prior FROM marketplace.stock_reservations
 WHERE idempotency_key=p_idempotency_key FOR UPDATE;
 IF FOUND THEN
  IF prior.listing_id <> p_listing_id OR prior.buyer_principal_id <> p_buyer_principal_id
    OR prior.quantity <> p_quantity THEN
   RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED_DIFFERENTLY' USING ERRCODE='23505';
  END IF;
  RETURN jsonb_build_object('reservation_id',prior.id::text,'state',prior.status,
    'idempotent_replay',true,'expires_at',prior.expires_at);
 END IF;
 UPDATE marketplace.listings AS l SET
  quantity=l.quantity-p_quantity,
  status=CASE WHEN l.quantity=p_quantity THEN 'sold_out' ELSE l.status END,
  state_version=l.state_version+1,updated_at=now()
 FROM marketplace.silo_contracts AS sc, marketplace.supply_attestations AS sa
 WHERE l.id=p_listing_id AND l.status='published' AND l.quantity>=p_quantity
  AND sc.silo_id=l.silo_id AND sc.status='active'
  AND sc.publication_approved_at IS NOT NULL AND sc.legal_review_approved_at IS NOT NULL
  AND sa.listing_id=l.id AND sa.silo_id=l.silo_id AND sa.status='verified'
  AND sa.verified_at IS NOT NULL AND sa.expires_at>now()
  AND sa.verified_quantity>=l.quantity
  AND NOT EXISTS (
   SELECT 1 FROM marketplace.organizations seller
   WHERE seller.id=l.organization_id AND seller.owner_principal_id=p_buyer_principal_id
  )
 RETURNING l.quantity INTO remaining;
 IF NOT FOUND THEN
  RAISE EXCEPTION 'LISTING_UNAVAILABLE_OR_NOT_VERIFIED' USING ERRCODE='P0001';
 END IF;
 INSERT INTO marketplace.stock_reservations
 (listing_id,buyer_principal_id,idempotency_key,quantity,expires_at)
 VALUES(p_listing_id,p_buyer_principal_id,p_idempotency_key,p_quantity,
 now()+make_interval(mins=>p_hold_minutes))
 RETURNING id INTO reservation_id;
 RETURN jsonb_build_object('reservation_id',reservation_id::text,
 'state','held','idempotent_replay',false,'remaining_quantity',remaining);
END
$fn$;
REVOKE ALL ON FUNCTION marketplace.reserve_stock_v2(uuid,text,text,integer,integer) FROM PUBLIC;
COMMENT ON FUNCTION marketplace.reserve_stock_v2(uuid,text,text,integer,integer) IS
 'CUBE v2 cross-domain guarded stock hold. Requires active approved silo and independent supply attestation. No Stripe settlement or fulfillment.';
