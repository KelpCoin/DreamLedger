-- CUBE v2 safely releases expired, never-checkout-attached reservations.
-- Payment-linked holds require independently reconciled expiry/refund evidence.
-- Production requires trusted scheduled invocation, not a public HTTP route.
CREATE FUNCTION marketplace.release_unpaid_expired_holds_v2(p_limit integer DEFAULT 100)
RETURNS TABLE(reservation_id uuid, listing_id uuid, silo_id text, recovered_quantity integer)
LANGUAGE plpgsql SECURITY INVOKER SET search_path=marketplace,pg_catalog
AS $fn$
DECLARE h marketplace.stock_reservations%ROWTYPE;
DECLARE l marketplace.listings%ROWTYPE;
DECLARE attested boolean;
BEGIN
 IF p_limit IS NULL OR p_limit < 1 OR p_limit > 500
 THEN RAISE EXCEPTION 'INVALID_REAPER_LIMIT' USING ERRCODE='22023'; END IF;
 FOR h IN
  SELECT * FROM marketplace.stock_reservations
  WHERE status='held' AND expires_at < now()
    AND provider_checkout_id IS NULL AND provider_event_id IS NULL
  ORDER BY expires_at,id
  FOR UPDATE SKIP LOCKED LIMIT p_limit
 LOOP
   SELECT * INTO l FROM marketplace.listings WHERE id=h.listing_id FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'MISSING_LISTING_FOR_RESERVATION'; END IF;
   SELECT EXISTS (
      SELECT 1 FROM marketplace.supply_attestations sa
      JOIN marketplace.silo_contracts sc ON sc.silo_id=sa.silo_id
      WHERE sa.listing_id=l.id AND sa.silo_id=l.silo_id
        AND sa.status='verified' AND sa.expires_at>now()
        AND sa.verified_quantity>=l.quantity+h.quantity
        AND sc.status='active' AND sc.publication_approved_at IS NOT NULL
        AND sc.legal_review_approved_at IS NOT NULL
   ) INTO attested;
   UPDATE marketplace.listings SET
     quantity=quantity+h.quantity,
     status=CASE
       WHEN attested AND status='sold_out' THEN 'published'
       WHEN status='sold_out' THEN 'draft'
       ELSE status END,
     state_version=state_version+1,updated_at=now()
   WHERE id=l.id;
   UPDATE marketplace.stock_reservations SET status='released',updated_at=now()
   WHERE id=h.id AND status='held';
   reservation_id:=h.id; listing_id:=l.id; silo_id:=l.silo_id;
   recovered_quantity:=h.quantity;
   RETURN NEXT;
 END LOOP;
END
$fn$;
REVOKE ALL ON FUNCTION marketplace.release_unpaid_expired_holds_v2(integer) FROM PUBLIC;
COMMENT ON FUNCTION marketplace.release_unpaid_expired_holds_v2(integer) IS
 'Internal CUBE v2 expired hold reaper. Never releases a provider-attached checkout without settlement reconciliation. Unknown attestation reverts sold_out item to draft.';
