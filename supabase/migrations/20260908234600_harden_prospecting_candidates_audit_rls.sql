alter table if exists public.prospecting_candidates_audit enable row level security;
comment on table public.prospecting_candidates_audit is 'Internal append-only prospecting audit surface. RLS is enabled and no public/authenticated policies are granted by default.';
