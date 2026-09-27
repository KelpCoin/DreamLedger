alter table public.economic_fulfillment_classes enable row level security;
alter table public.economic_fulfillment_bindings enable row level security;
revoke all on table public.economic_fulfillment_classes from anon, authenticated;
revoke all on table public.economic_fulfillment_bindings from anon, authenticated;
grant all on table public.economic_fulfillment_classes to service_role;
grant all on table public.economic_fulfillment_bindings to service_role;
