-- Resolve PostgREST overload ambiguity without changing the canonical JSONB SARC RPC.
CREATE OR REPLACE FUNCTION public.evaluate_economic_authorization_legacy_text(
  p_subject text,
  p_action text,
  p_resource text,
  p_context jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT public.evaluate_economic_authorization(
    p_subject::text,
    p_action::text,
    p_resource::text,
    coalesce(p_context, '{}'::jsonb)
  );
$function$;

REVOKE ALL ON FUNCTION public.evaluate_economic_authorization_legacy_text(text,text,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.evaluate_economic_authorization_legacy_text(text,text,text,jsonb) TO service_role;