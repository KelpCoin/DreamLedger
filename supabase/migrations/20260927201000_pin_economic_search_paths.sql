-- Pin economic SECURITY DEFINER functions to a trusted search path.
alter function public.create_economic_execution_packet(uuid,text,jsonb,jsonb,jsonb,text,jsonb,jsonb,jsonb)
  set search_path = public, pg_temp;
alter function public.dispatch_authorized_economic_packets(integer)
  set search_path = public, pg_temp;
alter function public.economic_consume_action_authorization(uuid,text)
  set search_path = public, pg_temp;
