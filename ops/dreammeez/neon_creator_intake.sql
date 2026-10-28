-- BECK / Agent Bridge creator intake.
-- Candidate migration for Neon's PRIMARY database, NOT automatically applied.
-- Private source art remains in Neon BYTEA until an approved object-store
-- migration is proven. Never enters public assets or commerce tables.
BEGIN;
CREATE TABLE IF NOT EXISTS public.beck_creator_cosmetic_drafts(
  draft_id text PRIMARY KEY CHECK(draft_id ~ '^ASSET-PEGGY-[A-F0-9]{20}$'),
  creator_id text NOT NULL CHECK(creator_id='peggy'),
  silo_id text NOT NULL DEFAULT 'SILO_AVATAR' CHECK(silo_id='SILO_AVATAR'),
  asset_type text NOT NULL DEFAULT 'cosmetic' CHECK(asset_type='cosmetic'),
  title text NOT NULL CHECK(length(title) BETWEEN 2 AND 90),
  wearable_slot text NOT NULL CHECK(wearable_slot IN
    ('head','hair','face','neck','body','hands','back','feet','accessory')),
  artist_credit text NOT NULL CHECK(length(artist_credit) BETWEEN 2 AND 90),
  source_filename text NOT NULL CHECK(length(source_filename) BETWEEN 1 AND 110),
  notes text NOT NULL DEFAULT '',
  media_type text NOT NULL CHECK(media_type IN ('image/png','image/jpeg','image/webp')),
  source_sha256 text NOT NULL CHECK(source_sha256 ~ '^[0-9a-f]{64}$'),
  metadata_sha256 text NOT NULL CHECK(metadata_sha256 ~ '^[0-9a-f]{64}$'),
  source_bytes bytea NOT NULL CHECK(octet_length(source_bytes) BETWEEN 1 AND 1200000),
  rights_confirmed boolean NOT NULL DEFAULT true CHECK(rights_confirmed),
  lifecycle text NOT NULL DEFAULT 'DRAFT' CHECK(lifecycle='DRAFT'),
  gauntlet_verdict text NOT NULL DEFAULT 'PENDING' CHECK(gauntlet_verdict='PENDING'),
  approval_required boolean NOT NULL DEFAULT true CHECK(approval_required),
  checkout_available boolean NOT NULL DEFAULT false CHECK(NOT checkout_available),
  published_at timestamptz CHECK(published_at IS NULL),
  price_minor integer CHECK(price_minor IS NULL),
  render_targets jsonb NOT NULL DEFAULT
    '{"dreamiez":{"state":"PENDING"},"kelp-atlantis":{"state":"PENDING"}}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(creator_id,source_sha256)
);
CREATE INDEX IF NOT EXISTS beck_creator_drafts_recent
  ON public.beck_creator_cosmetic_drafts(creator_id,created_at DESC);
REVOKE ALL ON TABLE public.beck_creator_cosmetic_drafts FROM PUBLIC;

-- Strict, bounded, idempotent insertion. No publication, price, entitlement,
-- checkout or inventory change is possible inside this draft table.
CREATE OR REPLACE FUNCTION public.beck_creator_submit_draft_v1(
  p_draft_id text,p_creator_id text,p_title text,p_slot text,
  p_artist text,p_filename text,p_notes text,p_mime text,p_sha text,
  p_meta_sha text,p_base64 text
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER
SET search_path=pg_catalog,public AS $func$
DECLARE
  v public.beck_creator_cosmetic_drafts%ROWTYPE;
  v_bytes bytea;
  v_count integer;
  v_total bigint;
BEGIN
  IF p_creator_id IS DISTINCT FROM 'peggy'
    OR p_draft_id IS NULL OR p_draft_id !~ '^ASSET-PEGGY-[A-F0-9]{20}$'
    OR p_sha IS NULL OR p_sha !~ '^[0-9a-f]{64}$'
    OR p_meta_sha IS NULL OR p_meta_sha !~ '^[0-9a-f]{64}$'
    OR p_draft_id <> ('ASSET-PEGGY-' || upper(substr(p_sha,1,20)))
    OR p_title IS NULL OR length(p_title) NOT BETWEEN 2 AND 90
    OR p_artist IS NULL OR length(p_artist) NOT BETWEEN 2 AND 90
    OR p_filename IS NULL OR length(p_filename) NOT BETWEEN 1 AND 110
    OR p_filename LIKE '%/%' OR position(chr(92) in p_filename)>0
    OR p_slot NOT IN ('head','hair','face','neck','body','hands','back','feet','accessory')
    OR p_mime NOT IN ('image/png','image/jpeg','image/webp')
    OR p_base64 IS NULL OR length(p_base64)>1600100
    OR length(coalesce(p_notes,''))>500
  THEN RAISE EXCEPTION 'CREATOR_UPLOAD_POLICY_REFUSED'; END IF;
  v_bytes:=decode(p_base64,'base64');
  IF octet_length(v_bytes) NOT BETWEEN 1 AND 1200000
  THEN RAISE EXCEPTION 'CREATOR_UPLOAD_SIZE_REFUSED'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('BECK_CREATOR_UPLOAD:'||p_creator_id,0));
  SELECT * INTO v FROM public.beck_creator_cosmetic_drafts
     WHERE draft_id=p_draft_id FOR UPDATE;
  IF FOUND THEN
    IF v.source_sha256 IS DISTINCT FROM p_sha
      OR v.metadata_sha256 IS DISTINCT FROM p_meta_sha
    THEN RAISE EXCEPTION 'CREATOR_DUPLICATE_COLLISION'; END IF;
    RETURN jsonb_build_object('draft_id',v.draft_id,'status',v.lifecycle,
      'gauntlet',v.gauntlet_verdict,'approval_required',v.approval_required,
      'idempotent',true,'created_at',v.created_at);
  END IF;
  SELECT count(*),coalesce(sum(octet_length(source_bytes)),0)
    INTO v_count,v_total FROM public.beck_creator_cosmetic_drafts
    WHERE creator_id=p_creator_id;
  IF v_count>=100 OR v_total+octet_length(v_bytes)>50000000
    THEN RAISE EXCEPTION 'CREATOR_PRIVATE_STORAGE_QUOTA_HOLD'; END IF;
  INSERT INTO public.beck_creator_cosmetic_drafts(
    draft_id,creator_id,title,wearable_slot,artist_credit,source_filename,
    notes,media_type,source_sha256,metadata_sha256,source_bytes,rights_confirmed)
  VALUES(p_draft_id,p_creator_id,p_title,p_slot,p_artist,p_filename,
    coalesce(p_notes,''),p_mime,p_sha,p_meta_sha,v_bytes,true)
  RETURNING * INTO v;
  RETURN jsonb_build_object('draft_id',v.draft_id,'status',v.lifecycle,
    'gauntlet',v.gauntlet_verdict,'approval_required',v.approval_required,
    'idempotent',false,'created_at',v.created_at);
END;
$func$;
REVOKE ALL ON FUNCTION public.beck_creator_submit_draft_v1(
  text,text,text,text,text,text,text,text,text,text,text) FROM PUBLIC;
-- REQUIRED at promotion:
-- create a dedicated non-owner role for creator intake, grant only SELECT and
-- INSERT on this single table, plus EXECUTE on this specific function.
-- Do not grant UPDATE, DELETE, DROP, sales, user, or commerce access.
COMMIT;
