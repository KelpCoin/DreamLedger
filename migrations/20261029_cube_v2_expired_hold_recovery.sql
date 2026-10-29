-- CUBE master: conservative recovery for expired holds with NO provider checkout.
-- Provider-linked holds require independent checkout/payment reconciliation first.
-- This is an internal operations primitive, not an HTTP route.
CREATE OR REPLACE FUNCTION marketplace.release_expired_unlinked_holds_v1(
 p_limit integer DEFAULT 100
) RETURNS TABLE(released_reservations integer, restored_units bigint)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = marketplace, pg_catalog AS $fn$
DECLARE h record; n integer := 0; q bigint := 0;
BEGIN
 IF p_limit IS NULL OR p_limit < 1 OR p_limit > 500 THEN
   RAISE EXCEPTION 'INVALID_BATCH_LIMIT' USING ERRCODE='22023';
 END IF;
 FOR h IN
   SELECT r.id,r.listing_id,r.quantity
   FROM marketplace.stock_reservations r
   WHERE r.status='held' AND r.expires_at <= now()
    AND r.provider_checkout_id IS NULL AND r.provider_event_id IS NULL
   ORDER BY r.expires_at,r.id
   LIMIT p_limit FOR UPDATE SKIP LOCKED
 LOOP
   UPDATE marketplace.listings l
   SET quantity=l.quantity+h.quantity,
       status=CASE WHEN l.status='sold_out' THEN 'published' ELSE l.status END,
       state_version=l.state_version+1,
       updated_at=now()
   WHERE l.id=h.listing_id
     AND l.status IN ('sold_out','published');
   IF NOT FOUND THEN
     RAISE EXCEPTION 'LISTING_NOT_RESTORABLE' USING ERRCODE='P0001';
   END IF;
   UPDATE marketplace.stock_reservations r
   SET status='released',updated_at=now()
   WHERE r.id=h.id AND r.status='held'
     AND r.provider_checkout_id IS NULL AND r.provider_event_id IS NULL;
   IF NOT FOUND THEN
     RAISE EXCEPTION 'HOLD_CHANGED_DURING_RELEASE' USING ERRCODE='P0001';
   END IF;
   n:=n+1; q:=q+h.quantity;
 END LOOP;
 RETURN QUERY SELECT n,q;
END
$fn$;
REVOKE ALL ON FUNCTION marketplace.release_expired_unlinked_holds_v1(integer) FROM PUBLIC;
COMMENT ON FUNCTION marketplace.release_expired_unlinked_holds_v1(integer) IS
'Internal, transactionally idempotent recovery of expired holds never associated with a provider checkout. Does not release checkout-linked holds or prove payment state.';
