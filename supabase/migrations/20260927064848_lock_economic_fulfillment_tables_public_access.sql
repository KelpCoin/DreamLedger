BEGIN;
ALTER TABLE public.economic_fulfillment_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.economic_fulfillment_bindings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.economic_fulfillment_classes FROM anon, authenticated;
REVOKE ALL ON TABLE public.economic_fulfillment_bindings FROM anon, authenticated;
GRANT ALL ON TABLE public.economic_fulfillment_classes TO service_role;
GRANT ALL ON TABLE public.economic_fulfillment_bindings TO service_role;
COMMIT;
