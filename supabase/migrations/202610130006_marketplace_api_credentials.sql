-- Hashed marketplace API credentials. Plain tokens are returned once at creation and never stored.
begin;
create table if not exists public.marketplace_api_credentials (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  credential_type text not null check (credential_type in ('buyer','supplier','agent')),
  party_id uuid not null references public.marketplace_parties(id),
  scopes text[] not null default '{}',
  agent_uri text,
  principal_party_id uuid references public.marketplace_parties(id),
  status text not null default 'active' check (status in ('active','revoked','expired')),
  expires_at timestamptz,
  created_by text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz,
  check ((credential_type='agent' and agent_uri is not null and principal_party_id is not null) or credential_type<>'agent')
);
create index if not exists marketplace_api_credentials_party_idx on public.marketplace_api_credentials(party_id,credential_type,status);
alter table public.marketplace_api_credentials enable row level security;
revoke all on public.marketplace_api_credentials from anon,authenticated;
grant select,insert,update,delete on public.marketplace_api_credentials to service_role;
commit;
