-- Public MTG collection profiles and safe, private-by-default sharing.
-- Imported inventory remains private. The only public read surface is a
-- definer-rights RPC that explicitly returns an allow-listed set of fields.
alter table public.mtg_collection_inventory
  add column if not exists printing_id text,
  add column if not exists visibility text not null default 'private'
    check (visibility in ('private', 'public')),
  add column if not exists availability text not null default 'not_for_trade'
    check (availability in ('not_for_trade', 'tradeable', 'for_sale', 'wanted'));

create index if not exists mtg_collection_public_owner_idx
  on public.mtg_collection_inventory (owner_id, visibility, card_name)
  where visibility = 'public';

create table if not exists public.mtg_collection_profiles (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  slug text not null unique
    check (slug = lower(slug) and slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'),
  display_name text not null check (length(trim(display_name)) between 1 and 80),
  bio text not null default '' check (length(bio) <= 500),
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mtg_collection_profiles_public_slug_idx
  on public.mtg_collection_profiles (slug)
  where is_public = true;

alter table public.mtg_collection_profiles enable row level security;

drop policy if exists "mtg collection profile owner select" on public.mtg_collection_profiles;
create policy "mtg collection profile owner select"
  on public.mtg_collection_profiles
  for select to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists "mtg collection profile owner insert" on public.mtg_collection_profiles;
create policy "mtg collection profile owner insert"
  on public.mtg_collection_profiles
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

drop policy if exists "mtg collection profile owner update" on public.mtg_collection_profiles;
create policy "mtg collection profile owner update"
  on public.mtg_collection_profiles
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists "mtg collection profile owner delete" on public.mtg_collection_profiles;
create policy "mtg collection profile owner delete"
  on public.mtg_collection_profiles
  for delete to authenticated
  using (owner_id = (select auth.uid()));

grant select, insert, update, delete on public.mtg_collection_profiles to authenticated;
revoke all on public.mtg_collection_profiles from anon;

create or replace function public.get_public_mtg_collection(
  p_slug text,
  p_limit integer default 60,
  p_offset integer default 0
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select jsonb_build_object(
    'profile', jsonb_build_object(
      'slug', p.slug,
      'display_name', p.display_name,
      'bio', p.bio
    ),
    'cards', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'card_name', i.card_name,
          'set_code', i.set_code,
          'collector_number', i.collector_number,
          'printing_id', i.printing_id,
          'quantity', i.quantity,
          'condition', i.condition,
          'language', i.language,
          'finish', i.finish,
          'availability', i.availability,
          'price_nzd', case when i.availability = 'for_sale' then i.price_nzd else null end
        )
        order by i.card_name, i.set_code, i.collector_number
      )
      from public.mtg_collection_inventory i
      where i.owner_id = p.owner_id
        and i.visibility = 'public'
        and i.status not in ('sold', 'quarantined')
      offset greatest(coalesce(p_offset, 0), 0)
      limit least(greatest(coalesce(p_limit, 60), 1), 100)
    ), '[]'::jsonb),
    'offset', greatest(coalesce(p_offset, 0), 0),
    'limit', least(greatest(coalesce(p_limit, 60), 1), 100),
    'total_count', (
      select count(*)::integer
      from public.mtg_collection_inventory i
      where i.owner_id = p.owner_id
        and i.visibility = 'public'
        and i.status not in ('sold', 'quarantined')
    )
  )
  from public.mtg_collection_profiles p
  where p.slug = lower(trim(coalesce(p_slug, '')))
    and p.is_public = true;
$function$;

revoke all on function public.get_public_mtg_collection(text, integer, integer) from public;
grant execute on function public.get_public_mtg_collection(text, integer, integer) to anon, authenticated;

comment on function public.get_public_mtg_collection(text, integer, integer) is
  'Public MTG collection projection. Returns only explicit public cards and allow-listed fields. Never returns owner_id, price for non-sale cards, inventory fingerprint, private metadata or other account details.';
