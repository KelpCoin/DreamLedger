-- Canonical DreamMeez identity bridge for Kelplantis.
-- This migration is intentionally additive. It does not rewrite existing player state.
-- Production application requires explicit approval before applying this migration.

alter table public.kelplantis_players
  add column if not exists account_id text,
  add column if not exists avatar_id uuid;

create unique index if not exists kelplantis_players_account_id_uidx
  on public.kelplantis_players(account_id)
  where account_id is not null;

create unique index if not exists kelplantis_players_avatar_id_uidx
  on public.kelplantis_players(avatar_id)
  where avatar_id is not null;

alter table public.kelplantis_players
  drop constraint if exists kelplantis_players_account_id_fkey;

alter table public.kelplantis_players
  add constraint kelplantis_players_account_id_fkey
  foreign key (account_id)
  references public.dreamledger_accounts(id)
  on delete set null;

alter table public.kelplantis_players
  drop constraint if exists kelplantis_players_avatar_id_fkey;

alter table public.kelplantis_players
  add constraint kelplantis_players_avatar_id_fkey
  foreign key (avatar_id)
  references public.dreammeez_avatars(avatar_id)
  on delete set null;

create unique index if not exists dreammeez_avatars_account_avatar_uidx
  on public.dreammeez_avatars(account_id, avatar_id);

alter table public.kelplantis_players
  drop constraint if exists kelplantis_players_account_avatar_match;

alter table public.kelplantis_players
  add constraint kelplantis_players_account_avatar_match
  foreign key (account_id, avatar_id)
  references public.dreammeez_avatars(account_id, avatar_id)
  on delete set null;

comment on column public.kelplantis_players.account_id is 'Canonical DreamLedger account owner. Nullable for legacy/unbound players.';
comment on column public.kelplantis_players.avatar_id is 'Canonical DreamMeez avatar identity used by Kelplantis. Nullable for legacy/unbound players.';
