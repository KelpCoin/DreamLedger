-- BECK advertising reservation candidate. NOT applied to production by this PR.
-- Must run in a transaction, on the selected existing Supabase project, after approval.
-- Scope is (exhaust,silo,canvas), not a DreamLedger-only storefront.
BEGIN;
CREATE TABLE IF NOT EXISTS public.beck_ad_reservations (
  reservation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exhaust text NOT NULL CHECK (exhaust ~ '^[a-z0-9_-]{2,80}$'),
  silo text NOT NULL CHECK (silo ~ '^[a-z0-9_-]{2,80}$'),
  canvas text NOT NULL CHECK (canvas ~ '^[a-z0-9_-]{2,80}$'),
  idempotency_key text NOT NULL CHECK (length(idempotency_key) BETWEEN 8 AND 128),
  x integer NOT NULL CHECK (x >= 0),
  y integer NOT NULL CHECK (y >= 0),
  width integer NOT NULL CHECK (width BETWEEN 1 AND 100000),
  height integer NOT NULL CHECK (height BETWEEN 1 AND 100000),
  canvas_width integer NOT NULL CHECK (canvas_width BETWEEN 1 AND 100000),
  canvas_height integer NOT NULL CHECK (canvas_height BETWEEN 1 AND 100000),
  campaign_start timestamptz NOT NULL,
  campaign_end timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'HELD' CHECK (status IN ('HELD','PAID','APPROVED','PUBLISHED','CANCELLED','EXPIRED')),
  hold_expires_at timestamptz NOT NULL,
  price_minor integer NOT NULL CHECK (price_minor > 0),
  currency text NOT NULL CHECK (currency IN ('NZD','USD')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (exhaust, silo, canvas, idempotency_key),
  CHECK (x + width <= canvas_width AND y + height <= canvas_height),
  CHECK (campaign_start < campaign_end)
);
CREATE INDEX IF NOT EXISTS beck_ad_reservations_scope_idx
  ON public.beck_ad_reservations (exhaust, silo, canvas, status, campaign_start, campaign_end);
ALTER TABLE public.beck_ad_reservations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.beck_ad_reservations FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.beck_ad_reservations TO service_role;

-- SECURITY DEFINER: this function must be called only by trusted backend using
-- the service-role credential. No browser/agent-facing calls are permitted.
CREATE OR REPLACE FUNCTION public.beck_ad_reserve_tile(
  p_exhaust text, p_silo text, p_canvas text, p_key text,
  p_x integer, p_y integer, p_width integer, p_height integer,
  p_canvas_width integer, p_canvas_height integer,
  p_start timestamptz, p_end timestamptz,
  p_price_minor integer, p_currency text, p_hold_minutes integer DEFAULT 30
) RETURNS public.beck_ad_reservations
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE existing public.beck_ad_reservations; created public.beck_ad_reservations;
BEGIN
  IF p_exhaust IS NULL OR p_exhaust !~ '^[a-z0-9_-]{2,80}$'
    OR p_silo IS NULL OR p_silo !~ '^[a-z0-9_-]{2,80}$'
    OR p_canvas IS NULL OR p_canvas !~ '^[a-z0-9_-]{2,80}$'
    OR p_key IS NULL OR length(p_key) NOT BETWEEN 8 AND 128
    OR p_x IS NULL OR p_y IS NULL OR p_width IS NULL OR p_height IS NULL
    OR p_canvas_width IS NULL OR p_canvas_height IS NULL
    OR p_x < 0 OR p_y < 0 OR p_width < 1 OR p_height < 1
    OR p_canvas_width < 1 OR p_canvas_height < 1
    OR p_canvas_width > 100000 OR p_canvas_height > 100000
    OR p_x::bigint+p_width > p_canvas_width
    OR p_y::bigint+p_height > p_canvas_height
    OR p_start IS NULL OR p_end IS NULL OR p_start >= p_end
    OR p_price_minor IS NULL OR p_price_minor <= 0
    OR p_currency NOT IN ('NZD','USD')
    OR p_hold_minutes IS NULL OR p_hold_minutes NOT BETWEEN 5 AND 60
  THEN RAISE EXCEPTION 'invalid_beck_reservation' USING ERRCODE='22023'; END IF;

  -- Serializes all claims within one physical canvas, across worker processes.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_exhaust||':'||p_silo||':'||p_canvas,0));

  SELECT * INTO existing FROM public.beck_ad_reservations
   WHERE exhaust=p_exhaust AND silo=p_silo AND canvas=p_canvas AND idempotency_key=p_key;
  IF FOUND THEN
    IF existing.x <> p_x OR existing.y <> p_y
      OR existing.width <> p_width OR existing.height <> p_height
      OR existing.canvas_width <> p_canvas_width OR existing.canvas_height <> p_canvas_height
      OR existing.campaign_start <> p_start OR existing.campaign_end <> p_end
      OR existing.price_minor <> p_price_minor OR existing.currency <> p_currency
    THEN RAISE EXCEPTION 'idempotency_conflict' USING ERRCODE='23505'; END IF;
    -- Never revive an expired hold by replaying the same key.
    RETURN existing;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.beck_ad_reservations r
    WHERE r.exhaust=p_exhaust AND r.silo=p_silo AND r.canvas=p_canvas
      AND r.status IN ('HELD','PAID','APPROVED','PUBLISHED')
      AND (r.status <> 'HELD' OR r.hold_expires_at > clock_timestamp())
      AND p_start < r.campaign_end AND r.campaign_start < p_end
      AND p_x < r.x+r.width AND r.x < p_x+p_width
      AND p_y < r.y+r.height AND r.y < p_y+p_height
  ) THEN RAISE EXCEPTION 'inventory_overlap' USING ERRCODE='P0001'; END IF;

  INSERT INTO public.beck_ad_reservations (
    exhaust,silo,canvas,idempotency_key,x,y,width,height,canvas_width,canvas_height,
    campaign_start,campaign_end,hold_expires_at,price_minor,currency
  ) VALUES (
    p_exhaust,p_silo,p_canvas,p_key,p_x,p_y,p_width,p_height,p_canvas_width,p_canvas_height,
    p_start,p_end,clock_timestamp()+make_interval(mins=>p_hold_minutes),p_price_minor,p_currency
  ) RETURNING * INTO created;
  RETURN created;
END $$;

REVOKE ALL ON FUNCTION public.beck_ad_reserve_tile(
  text,text,text,text,integer,integer,integer,integer,integer,integer,
  timestamptz,timestamptz,integer,text,integer
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.beck_ad_reserve_tile(
  text,text,text,text,integer,integer,integer,integer,integer,integer,
  timestamptz,timestamptz,integer,text,integer
) TO service_role;
COMMIT;
