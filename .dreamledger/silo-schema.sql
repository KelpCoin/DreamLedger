-- DreamLedger Multi-Silo Economy Schema
-- Supabase SQL migration

create table if not exists dreamledger_events (
    id uuid primary key default gen_random_uuid(),
    ts timestamptz default now(),
    source text,
    type text,
    silo text,
    payload jsonb
);

create index if not exists idx_dreamledger_events_silo on dreamledger_events(silo);
create index if not exists idx_dreamledger_events_ts on dreamledger_events(ts);

create table if not exists dreamledger_silos (
    id uuid primary key default gen_random_uuid(),
    name text unique,
    active boolean default true,
    metadata jsonb default '{}'::jsonb,
    created_at timestamptz default now()
);

insert into dreamledger_silos (name, active)
values 
('dreamledger', true),
('happy_homarid', true),
('mtg_nz', true)
on conflict (name) do nothing;