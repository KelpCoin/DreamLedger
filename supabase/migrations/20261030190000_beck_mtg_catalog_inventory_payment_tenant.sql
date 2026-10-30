-- Isolated MTG master hardening primitives. Buyer-facing checkout remains held.
CREATE TABLE IF NOT EXISTS public.catalog_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  supplier_id text NOT NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'inactive' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, tenant_id)
);

CREATE TABLE IF NOT EXISTS public.product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  product_id uuid NOT NULL,
  supplier_id text NOT NULL,
  supplier_sku text NOT NULL,
  is_physical boolean NOT NULL DEFAULT true,
  availability text NOT NULL DEFAULT 'unavailable' CHECK (availability IN ('available', 'unavailable')),
  price_minor integer NOT NULL CHECK (price_minor > 0),
  currency text NOT NULL DEFAULT 'NZD' CHECK (currency = 'NZD'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (supplier_id, supplier_sku),
  UNIQUE (id, tenant_id),
  FOREIGN KEY (product_id, tenant_id) REFERENCES public.catalog_products(id, tenant_id)
);

CREATE TABLE IF NOT EXISTS public.catalog_stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ready', 'published', 'suspended')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, tenant_id)
);

CREATE TABLE IF NOT EXISTS public.catalog_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  store_id uuid NOT NULL,
  variant_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ready', 'published', 'held')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, variant_id),
  FOREIGN KEY (store_id, tenant_id) REFERENCES public.catalog_stores(id, tenant_id),
  FOREIGN KEY (variant_id, tenant_id) REFERENCES public.product_variants(id, tenant_id)
);

CREATE OR REPLACE FUNCTION public.guard_catalog_listing_publication()
RETURNS trigger LANGUAGE plpgsql AS $function$
DECLARE
  v_product_status text;
  v_availability text;
  v_store_status text;
BEGIN
  IF NEW.status IN ('ready', 'published') THEN
    SELECT p.status, v.availability, s.status
      INTO v_product_status, v_availability, v_store_status
      FROM public.product_variants v
      JOIN public.catalog_products p ON p.id = v.product_id AND p.tenant_id = v.tenant_id
      JOIN public.catalog_stores s ON s.id = NEW.store_id AND s.tenant_id = NEW.tenant_id
     WHERE v.id = NEW.variant_id AND v.tenant_id = NEW.tenant_id;
    IF v_product_status IS DISTINCT FROM 'active' OR v_availability IS DISTINCT FROM 'available' THEN
      RAISE EXCEPTION 'listing requires an active supplier product and an available variant' USING ERRCODE = '23514';
    END IF;
    IF v_store_status NOT IN ('ready', 'published') THEN
      RAISE EXCEPTION 'listing store is not ready' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS catalog_listing_publish_guard ON public.catalog_listings;
CREATE TRIGGER catalog_listing_publish_guard
BEFORE INSERT OR UPDATE OF status, variant_id, store_id ON public.catalog_listings
FOR EACH ROW EXECUTE FUNCTION public.guard_catalog_listing_publication();

CREATE OR REPLACE FUNCTION public.guard_catalog_store_publication()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  IF NEW.status = 'published' AND NOT EXISTS (
    SELECT 1 FROM public.catalog_listings l
    JOIN public.product_variants v ON v.id = l.variant_id AND v.tenant_id = l.tenant_id
    JOIN public.catalog_products p ON p.id = v.product_id AND p.tenant_id = v.tenant_id
    WHERE l.store_id = NEW.id AND l.tenant_id = NEW.tenant_id
      AND l.status IN ('ready', 'published')
      AND p.status = 'active' AND v.availability = 'available'
  ) THEN
    RAISE EXCEPTION 'store cannot publish without a ready listing for an available variant' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS catalog_store_publish_guard ON public.catalog_stores;
CREATE TRIGGER catalog_store_publish_guard
BEFORE INSERT OR UPDATE OF status ON public.catalog_stores
FOR EACH ROW EXECUTE FUNCTION public.guard_catalog_store_publication();

CREATE TABLE IF NOT EXISTS public.sku_inventory (
  tenant_id uuid NOT NULL,
  variant_id uuid NOT NULL,
  quantity integer NOT NULL CHECK (quantity >= 0),
  reserved integer NOT NULL DEFAULT 0 CHECK (reserved >= 0 AND reserved <= quantity),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, variant_id),
  FOREIGN KEY (variant_id, tenant_id) REFERENCES public.product_variants(id, tenant_id)
);

CREATE TABLE IF NOT EXISTS public.inventory_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  variant_id uuid NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'committed', 'expired', 'cancelled')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (variant_id, tenant_id) REFERENCES public.product_variants(id, tenant_id)
);

CREATE OR REPLACE FUNCTION public.reserve_catalog_inventory(p_variant_id uuid, p_quantity integer, p_ttl interval DEFAULT interval '15 minutes')
RETURNS uuid LANGUAGE plpgsql AS $function$
DECLARE
  v_tenant_id uuid := current_setting('app.tenant_id', true)::uuid;
  v_reservation_id uuid;
BEGIN
  IF v_tenant_id IS NULL OR p_quantity <= 0 THEN RETURN NULL; END IF;
  PERFORM 1 FROM public.sku_inventory
   WHERE tenant_id = v_tenant_id AND variant_id = p_variant_id
   FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  UPDATE public.sku_inventory
     SET reserved = reserved + p_quantity, updated_at = now()
   WHERE tenant_id = v_tenant_id AND variant_id = p_variant_id
     AND quantity - reserved >= p_quantity;
  IF NOT FOUND THEN RETURN NULL; END IF;
  INSERT INTO public.inventory_reservations (tenant_id, variant_id, quantity, expires_at)
  VALUES (v_tenant_id, p_variant_id, p_quantity, now() + p_ttl)
  RETURNING id INTO v_reservation_id;
  RETURN v_reservation_id;
END
$function$;

CREATE OR REPLACE FUNCTION public.expire_catalog_reservations(p_limit integer DEFAULT 500)
RETURNS integer LANGUAGE plpgsql AS $function$
DECLARE
  v_released integer;
BEGIN
  WITH expired AS (
    SELECT id, tenant_id, variant_id, quantity
      FROM public.inventory_reservations
     WHERE status = 'reserved' AND expires_at <= now()
     ORDER BY expires_at
     FOR UPDATE SKIP LOCKED
     LIMIT p_limit
  ), released AS (
    UPDATE public.inventory_reservations r SET status = 'expired'
      FROM expired e WHERE r.id = e.id
      RETURNING e.tenant_id, e.variant_id, e.quantity
  ), release_totals AS (
    SELECT tenant_id, variant_id, sum(quantity) AS quantity
      FROM released
     GROUP BY tenant_id, variant_id
  )
  UPDATE public.sku_inventory i
     SET reserved = i.reserved - release_totals.quantity, updated_at = now()
    FROM release_totals
   WHERE i.tenant_id = release_totals.tenant_id AND i.variant_id = release_totals.variant_id;
  GET DIAGNOSTICS v_released = ROW_COUNT;
  RETURN v_released;
END
$function$;

CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  event_id text PRIMARY KEY,
  tenant_id uuid NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  applied_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.stripe_outbound_idempotency (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  business_order_id text NOT NULL,
  attempt_id text NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, business_order_id, attempt_id)
);

CREATE OR REPLACE FUNCTION public.persist_stripe_idempotency_key(p_business_order_id text, p_attempt_id text)
RETURNS text LANGUAGE plpgsql AS $function$
DECLARE
  v_tenant_id uuid := current_setting('app.tenant_id', true)::uuid;
  v_key text := 'order-' || p_business_order_id || '-' || p_attempt_id;
BEGIN
  IF v_tenant_id IS NULL OR p_business_order_id IS NULL OR p_attempt_id IS NULL THEN
    RAISE EXCEPTION 'tenant, order, and attempt are required' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.stripe_outbound_idempotency (tenant_id, business_order_id, attempt_id, idempotency_key)
  VALUES (v_tenant_id, p_business_order_id, p_attempt_id, v_key)
  ON CONFLICT (tenant_id, business_order_id, attempt_id)
  DO UPDATE SET business_order_id = EXCLUDED.business_order_id
  RETURNING idempotency_key INTO v_key;
  RETURN v_key;
END
$function$;

DO $rls$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'catalog_products', 'product_variants', 'catalog_stores', 'catalog_listings',
    'sku_inventory', 'inventory_reservations', 'stripe_webhook_events', 'stripe_outbound_idempotency'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', v_table);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (tenant_id)', v_table || '_tenant_id_idx', v_table);
    EXECUTE format('DROP POLICY IF EXISTS tenant_iso ON public.%I', v_table);
    EXECUTE format(
      'CREATE POLICY tenant_iso ON public.%I FOR ALL USING (tenant_id = current_setting(''app.tenant_id'', true)::uuid) WITH CHECK (tenant_id = current_setting(''app.tenant_id'', true)::uuid)',
      v_table
    );
  END LOOP;
END
$rls$;
