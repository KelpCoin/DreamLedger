-- DreamLedger Marketplace Schema
-- Enables multi-silo listings (MTG NZ, Happy Homarid, etc.)

create extension if not exists "uuid-ossp";

create table if not exists listings (
    id uuid primary key default uuid_generate_v4(),
    silo text not null,
    title text not null,
    description text,
    price numeric not null,
    image_url text,
    stock int default 1,
    stripe_price_id text,
    stripe_product_id text,
    seller text default 'biggie',
    created_at timestamptz default now()
);

create index if not exists idx_listings_silo on listings(silo);
create index if not exists idx_listings_created on listings(created_at);

alter table listings enable row level security;

create policy if not exists "public read listings"
on listings for select
using (true);

create policy if not exists "insert listings service only"
on listings for insert
with check (auth.role() = 'service_role');

create policy if not exists "update listings service only"
on listings for update
using (auth.role() = 'service_role');