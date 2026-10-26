-- Private inbound B2B RFQ intake. Anonymous submissions are never public listings.
create table if not exists public.marketplace_public_rfq_intake (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  company text not null check (length(trim(company)) between 2 and 120),
  contact_email text not null check (length(contact_email) <= 254),
  category text not null check (length(category) between 2 and 80),
  title text not null check (length(trim(title)) between 5 and 160),
  details text not null check (length(trim(details)) between 10 and 2000),
  budget_text text not null default '' check (length(budget_text) <= 120),
  region text not null check (length(trim(region)) between 2 and 120),
  contact_consent boolean not null default false check (contact_consent = true),
  privacy_notice_version text not null,
  source text not null default 'dreamledger-b2b',
  status text not null default 'received' check (status in ('received','reviewing','matched','closed','spam')),
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists marketplace_public_rfq_status_recent_idx
  on public.marketplace_public_rfq_intake(status,created_at desc);
alter table public.marketplace_public_rfq_intake enable row level security;
revoke all on public.marketplace_public_rfq_intake from public, anon, authenticated;
-- Only the server's service-role API can create or inspect these records. No automatic contact or publication.
