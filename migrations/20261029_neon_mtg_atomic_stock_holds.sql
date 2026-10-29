CREATE TABLE IF NOT EXISTS marketplace.stock_reservations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 listing_id uuid NOT NULL REFERENCES marketplace.listings(id),
 buyer_principal_id text NOT NULL CHECK (length(buyer_principal_id) BETWEEN 6 AND 128),
 idempotency_key text NOT NULL UNIQUE CHECK (length(idempotency_key) BETWEEN 16 AND 128),
 quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 10),
 status text NOT NULL DEFAULT 'held' CHECK (status IN ('held','converted','released','disputed')),
 expires_at timestamptz NOT NULL,
 provider_checkout_id text UNIQUE,
 provider_event_id text UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stock_reservations_held_expiry_idx
 ON marketplace.stock_reservations(expires_at) WHERE status='held';

CREATE OR REPLACE FUNCTION marketplace.reserve_stock(
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
 -- Serialize all repeats for the same key before touching stock.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_idempotency_key, 0));
 SELECT * INTO prior FROM marketplace.stock_reservations
 WHERE idempotency_key=p_idempotency_key FOR UPDATE;
 IF FOUND THEN
   IF prior.listing_id <> p_listing_id
      OR prior.buyer_principal_id <> p_buyer_principal_id
      OR prior.quantity <> p_quantity THEN
     RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED_DIFFERENTLY' USING ERRCODE='23505';
   END IF;
   RETURN jsonb_build_object('reservation_id',prior.id::text,
      'state',prior.status,'idempotent_replay',true,'expires_at',prior.expires_at);
 END IF;
 -- A single guarded UPDATE is the stock claim. Concurrent callers must
 -- lock this row and cannot reduce stock below zero.
 UPDATE marketplace.listings SET
   quantity = quantity - p_quantity,
   status = CASE WHEN quantity = p_quantity THEN 'sold_out' ELSE status END,
   state_version = state_version + 1,
   updated_at = now()
 WHERE id = p_listing_id AND silo_id = 'mtg'
   AND status = 'published' AND quantity >= p_quantity
   AND evidence ? 'physical_verification_receipt_sha256'
   AND evidence->>'physical_verification_receipt_sha256' ~ '^[0-9a-f]{64}$'
   AND NOT EXISTS (
     SELECT 1 FROM marketplace.organizations seller
     WHERE seller.id = marketplace.listings.organization_id
       AND seller.owner_principal_id = p_buyer_principal_id
   )
 RETURNING quantity INTO remaining;
 IF NOT FOUND THEN
   RAISE EXCEPTION 'LISTING_UNAVAILABLE_OR_NOT_VERIFIED' USING ERRCODE='P0001';
 END IF;
 INSERT INTO marketplace.stock_reservations(
  listing_id,buyer_principal_id,idempotency_key,quantity,expires_at
 ) VALUES (p_listing_id,p_buyer_principal_id,p_idempotency_key,
   p_quantity,now() + make_interval(mins=>p_hold_minutes))
 RETURNING id INTO reservation_id;
 RETURN jsonb_build_object('reservation_id',reservation_id::text,
   'state','held','idempotent_replay',false,'remaining_quantity',remaining);
END
$fn$;

REVOKE ALL ON FUNCTION marketplace.reserve_stock(uuid,text,text,integer,integer) FROM PUBLIC;

COMMENT ON FUNCTION marketplace.reserve_stock(uuid,text,text,integer,integer)
 IS 'BECK staging: owner-controlled authenticated call only. No public API. Stripe settlement and hold release require independent reconciliation.';
