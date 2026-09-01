alter view public.billboard_public set (security_invoker = true);
alter view public.commerce_funnel_daily set (security_invoker = true);
alter view public.resource_economics_daily set (security_invoker = true);
revoke execute on function public.billboard_allocate_position(integer, integer) from anon, authenticated;
