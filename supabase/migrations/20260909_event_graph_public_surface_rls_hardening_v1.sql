-- Event graph tables are internal derived data. Browser roles must not read or write them directly.
revoke all on table public.normalized_events from public, anon, authenticated;
revoke all on table public.event_relationships from public, anon, authenticated;
revoke all on table public.event_motifs from public, anon, authenticated;

alter table public.normalized_events enable row level security;
alter table public.event_relationships enable row level security;
alter table public.event_motifs enable row level security;
