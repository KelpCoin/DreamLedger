-- Control-plane tables are internal. Public Data API roles receive no direct table access.
-- Privileged server-side functions retain their existing authority model.
alter table public.kill_switch_events enable row level security;
alter table public.economic_attribution enable row level security;
alter table public.economic_actuators enable row level security;
alter table public.economic_human_interventions enable row level security;
alter table public.economic_replication enable row level security;
alter table public.economic_agent_events enable row level security;

revoke all on table public.kill_switch_events from anon, authenticated;
revoke all on table public.economic_attribution from anon, authenticated;
revoke all on table public.economic_actuators from anon, authenticated;
revoke all on table public.economic_human_interventions from anon, authenticated;
revoke all on table public.economic_replication from anon, authenticated;
revoke all on table public.economic_agent_events from anon, authenticated;
