-- Disposable PostgreSQL only. No real Neon data or creator files.
\set ON_ERROR_STOP on
DO $test$
DECLARE
  a jsonb; b jsonb; refused boolean;
  p text := encode(convert_to('CI_SYNTHETIC_IMAGE_NOT_ACTUAL_PNG','UTF8'),'base64');
  id text := 'ASSET-PEGGY-' || repeat('A',20);
BEGIN
  SELECT public.beck_creator_submit_draft_v1(
    id,'peggy','Peggy Ink Wings','back','Peggy','wings.png','private candidate',
    'image/png',repeat('a',64),repeat('b',64),p) INTO a;
  IF a->>'status'<>'DRAFT' OR a->>'gauntlet'<>'PENDING'
    OR (a->>'approval_required')::boolean IS DISTINCT FROM true
    OR (a->>'idempotent')::boolean IS DISTINCT FROM false
  THEN RAISE EXCEPTION 'DRAFT_NOT_PRIVATE_HOLD'; END IF;
  SELECT public.beck_creator_submit_draft_v1(
    id,'peggy','Peggy Ink Wings','back','Peggy','wings.png','private candidate',
    'image/png',repeat('a',64),repeat('b',64),p) INTO b;
  IF (b->>'idempotent')::boolean IS DISTINCT FROM true
  THEN RAISE EXCEPTION 'UPLOAD_NOT_IDEMPOTENT'; END IF;
  IF (SELECT count(*) FROM public.beck_creator_cosmetic_drafts)<>1
  THEN RAISE EXCEPTION 'DUPLICATE_CREATOR_ART'; END IF;
  -- A second owner can submit independently, without taking Peggy's asset ID.
  SELECT public.beck_creator_submit_draft_v1(
    'ASSET-BIGGIE-'||repeat('C',20),'biggie','Biggie Ink Crown',
    'head','Biggie','crown.png','owner original',
    'image/png',repeat('c',64),repeat('e',64),p) INTO b;
  IF b->>'status'<>'DRAFT'
    OR (SELECT count(*) FROM public.beck_creator_cosmetic_drafts WHERE creator_id='biggie')<>1
    OR (SELECT count(*) FROM public.beck_creator_cosmetic_drafts WHERE creator_id='peggy')<>1
  THEN RAISE EXCEPTION 'SECOND_OWNER_NOT_ISOLATED'; END IF;
  refused:=false;
  BEGIN
    PERFORM public.beck_creator_submit_draft_v1(
      'ASSET-PEGGY-'||repeat('A',20),'biggie','Impersonated',
      'back','Biggie','x.png','','image/png',repeat('a',64),repeat('b',64),p);
  EXCEPTION WHEN raise_exception THEN refused:=true; END;
  IF NOT refused THEN RAISE EXCEPTION 'CROSS_OWNER_ASSET_ACCEPTED'; END IF;

  SELECT public.beck_creator_submit_draft_v1(
    'ASSET-PEGGY-'||repeat('F',20),'peggy','AI-enhanced Ink Wings',
    'back','Peggy','enhanced.png','enhancement of my original',
    'image/png',repeat('f',64),repeat('c',64),p,
    'ai_enhanced',id) INTO b;
  IF b->>'status'<>'DRAFT'
    OR (SELECT parent_draft_id FROM public.beck_creator_cosmetic_drafts WHERE draft_id='ASSET-PEGGY-'||repeat('F',20))<>id
  THEN RAISE EXCEPTION 'DERIVATIVE_LINEAGE_MISSING'; END IF;
  refused:=false;
  BEGIN
    PERFORM public.beck_creator_submit_draft_v1(
      'ASSET-BIGGIE-'||repeat('E',20),'biggie','Cross-owner derivative',
      'body','Biggie','x.png','','image/png',repeat('e',64),repeat('c',64),p,
      'ai_enhanced',id);
  EXCEPTION WHEN raise_exception THEN refused:=true; END;
  IF NOT refused THEN RAISE EXCEPTION 'CROSS_OWNER_DERIVATIVE_ACCEPTED'; END IF;
  refused:=false;
  BEGIN
    PERFORM public.beck_creator_submit_draft_v1(id,'peggy','Altered',
      'back','Peggy','wings.png','','image/png',repeat('a',64),repeat('c',64),p);
  EXCEPTION WHEN raise_exception THEN refused:=true; END;
  IF NOT refused THEN RAISE EXCEPTION 'METADATA_COLLISION_ACCEPTED'; END IF;
  refused:=false;
  BEGIN
    PERFORM public.beck_creator_submit_draft_v1(
      'ASSET-PEGGY-'||repeat('D',20),'amplissa','Out of silo',
      'body','Peggy','x.png','','image/png',repeat('d',64),repeat('e',64),p);
  EXCEPTION WHEN raise_exception THEN refused:=true; END;
  IF NOT refused THEN RAISE EXCEPTION 'ADULT_CROSS_SILO_ACCEPTED'; END IF;
  refused:=false;
  BEGIN
    PERFORM public.beck_creator_submit_draft_v1(
      'ASSET-PEGGY-'||repeat('D',20),'peggy','Path traversal',
      'body','Peggy','../x.png','','image/png',repeat('d',64),repeat('e',64),p);
  EXCEPTION WHEN raise_exception THEN refused:=true; END;
  IF NOT refused THEN RAISE EXCEPTION 'PATH_TRAVERSAL_ACCEPTED'; END IF;
  IF EXISTS (SELECT 1 FROM public.beck_creator_cosmetic_drafts
    WHERE published_at IS NOT NULL OR checkout_available
      OR price_minor IS NOT NULL OR NOT approval_required
      OR gauntlet_verdict<>'PENDING')
  THEN RAISE EXCEPTION 'DRAFT_ENTERED_COMMERCE'; END IF;
  IF (SELECT octet_length(source_bytes) FROM public.beck_creator_cosmetic_drafts WHERE draft_id=id)
    <>octet_length(decode(p,'base64'))
  THEN RAISE EXCEPTION 'SOURCE_BYTES_MISMATCH'; END IF;
END $test$;
CREATE ROLE creator_untrusted NOLOGIN;
DO $test$ BEGIN
 IF has_table_privilege('creator_untrusted','public.beck_creator_cosmetic_drafts','SELECT')
   OR has_table_privilege('creator_untrusted','public.beck_creator_cosmetic_drafts','INSERT')
   OR has_function_privilege('creator_untrusted',
      'public.beck_creator_submit_draft_v1(text,text,text,text,text,text,text,text,text,text,text,text,text)','EXECUTE')
 THEN RAISE EXCEPTION 'CREATOR_FUNCTIONS_NOT_PRIVATE'; END IF;
END $test$;
SELECT 'BECK_DUAL_OWNER_CREATOR_NEON=PASS_PRIVATE_DRAFT_ONLY' AS proof;
