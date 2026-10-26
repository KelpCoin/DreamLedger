-- Private contact details and pending marketplace account applications.
begin;
alter table public.marketplace_parties add column if not exists contact_email text;
alter table public.marketplace_parties add column if not exists contact_email_verified_at timestamptz;
alter table public.marketplace_parties add column if not exists application_notes text;
create index if not exists marketplace_parties_pending_idx on public.marketplace_parties(status,created_at) where status='pending';
commit;
