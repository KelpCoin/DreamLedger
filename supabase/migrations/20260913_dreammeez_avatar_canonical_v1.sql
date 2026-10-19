create table if not exists public.dreammeez_avatars (
  account_id text primary key references public.dreamledger_accounts(id) on delete cascade,
  avatar_id uuid not null default gen_random_uuid() unique,
  appearance jsonb not null default '{"height":2,"build":2,"skin":5}'::jsonb,
  equipped jsonb not null default '{}'::jsonb,
  progression jsonb not null default '{}'::jsonb,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dreammeez_avatars_appearance_object check (jsonb_typeof(appearance) = 'object'),
  constraint dreammeez_avatars_equipped_object check (jsonb_typeof(equipped) = 'object'),
  constraint dreammeez_avatars_progression_object check (jsonb_typeof(progression) = 'object')
);

create table if not exists public.dreammeez_avatar_items (
  account_id text not null references public.dreamledger_accounts(id) on delete cascade,
  item_id text not null references public.commerce_items(item_id) on delete restrict,
  acquired_at timestamptz not null default now(),
  source text not null default 'grant',
  primary key (account_id, item_id)
);

create index if not exists dreammeez_avatar_items_item_idx
  on public.dreammeez_avatar_items(item_id);

alter table public.dreammeez_avatars enable row level security;
alter table public.dreammeez_avatar_items enable row level security;

revoke all on public.dreammeez_avatars from anon, authenticated;
revoke all on public.dreammeez_avatar_items from anon, authenticated;

comment on table public.dreammeez_avatars is 'Canonical DreamMeez avatar state. Accessed by the server runtime using the account session identity.';
comment on table public.dreammeez_avatar_items is 'Canonical DreamMeez avatar item ownership. Client cannot write ownership directly.';

create or replace function public.dreammeez_avatar_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.version = old.version + 1;
  return new;
end;
$$;

revoke all on function public.dreammeez_avatar_touch_updated_at() from public;

drop trigger if exists dreammeez_avatars_touch_updated_at on public.dreammeez_avatars;
create trigger dreammeez_avatars_touch_updated_at
before update on public.dreammeez_avatars
for each row execute function public.dreammeez_avatar_touch_updated_at();
