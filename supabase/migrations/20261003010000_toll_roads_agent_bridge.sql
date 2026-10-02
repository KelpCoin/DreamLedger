create table if not exists public.toll_roads (
  road_id text primary key,
  owner_passport_id text,
  silo_id text not null default 'api-access',
  slug text not null unique,
  title text not null,
  description text not null,
  price_nzd numeric(12,2) not null check (price_nzd > 0),
  calls_per_pack integer not null check (calls_per_pack > 0),
  ttl_days integer not null check (ttl_days > 0),
  status text not null default 'draft' check (status in ('draft','published','paused','archived')),
  public_route text not null,
  fulfillment text not null,
  evidence_hash text,
  created_at timestamptz not null default now()
);

create table if not exists public.toll_entitlements (
  entitlement_id text primary key,
  road_id text not null references public.toll_roads(road_id),
  buyer_reference_hash text,
  stripe_payment_id text not null,
  calls_remaining integer not null check (calls_remaining >= 0),
  expires_at timestamptz not null,
  key_id text not null unique,
  issued_at timestamptz not null default now(),
  reference text not null unique
);

create table if not exists public.toll_calls (
  call_id bigserial primary key,
  road_id text not null references public.toll_roads(road_id),
  key_id text not null,
  event_id text not null unique,
  input_hash text not null,
  output jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists toll_entitlements_road_key_idx on public.toll_entitlements(road_id,key_id);
create index if not exists toll_entitlements_expiry_idx on public.toll_entitlements(expires_at);
create index if not exists toll_calls_road_created_idx on public.toll_calls(road_id,created_at desc);

alter table public.toll_roads enable row level security;
alter table public.toll_entitlements enable row level security;
alter table public.toll_calls enable row level security;

revoke all on public.toll_roads, public.toll_entitlements, public.toll_calls from public, anon, authenticated;
grant all on public.toll_roads, public.toll_entitlements, public.toll_calls to service_role;

insert into public.toll_roads
(road_id,owner_passport_id,silo_id,slug,title,description,price_nzd,calls_per_pack,ttl_days,status,public_route,fulfillment)
values
('AGENT-BRIDGE-EVENTS-001',null,'api-access','agent-bridge-events','Agent Bridge Events','Submit structured events and receive deterministic automated receipts.',19,100,30,'published','/api/agent-bridge/events','Automated event receipt')
on conflict (road_id) do update set
title=excluded.title,description=excluded.description,price_nzd=excluded.price_nzd,calls_per_pack=excluded.calls_per_pack,ttl_days=excluded.ttl_days,status=excluded.status,public_route=excluded.public_route,fulfillment=excluded.fulfillment;

create or replace function public.upsert_toll_entitlement(
  p_entitlement_id text,p_road_id text,p_buyer_reference_hash text,p_stripe_payment_id text,
  p_key_id text,p_calls_remaining integer,p_expires_at timestamptz,p_reference text
) returns public.toll_entitlements
language plpgsql security definer set search_path=public
as $$
declare r public.toll_entitlements;
begin
  insert into public.toll_entitlements(entitlement_id,road_id,buyer_reference_hash,stripe_payment_id,calls_remaining,expires_at,key_id,reference)
  values(p_entitlement_id,p_road_id,p_buyer_reference_hash,p_stripe_payment_id,p_calls_remaining,p_expires_at,p_key_id,p_reference)
  on conflict (reference) do nothing;

  select * into r
    from public.toll_entitlements
   where reference=p_reference;

  if r.road_id<>p_road_id or r.stripe_payment_id<>p_stripe_payment_id then
    raise exception 'toll entitlement reference attribution mismatch';
  end if;

  return r;
end;
$$;

create or replace function public.consume_toll_entitlement(
  p_key_id text,p_road_id text,p_calls integer default 1
) returns jsonb
language plpgsql security definer set search_path=public
as $$
declare r public.toll_entitlements;
begin
  if p_calls<1 then
    return jsonb_build_object('consumed',false,'calls_remaining',0,'error','invalid_call_count');
  end if;

  update public.toll_entitlements
     set calls_remaining=calls_remaining-p_calls
   where key_id=p_key_id and road_id=p_road_id
     and expires_at>now() and calls_remaining>=p_calls
   returning * into r;

  if not found then return jsonb_build_object('consumed',false,'calls_remaining',0); end if;
  return jsonb_build_object('consumed',true,'calls_remaining',r.calls_remaining,'expires_at',r.expires_at);
end;
$$;

create or replace function public.record_toll_call(
  p_road_id text,p_key_id text,p_event_id text,p_input_hash text,p_output jsonb
) returns public.toll_calls
language plpgsql security definer set search_path=public
as $$
declare r public.toll_calls;
begin
  insert into public.toll_calls(road_id,key_id,event_id,input_hash,output)
  values(p_road_id,p_key_id,p_event_id,p_input_hash,p_output)
  returning * into r;
  return r;
end;
$$;

revoke all on function public.upsert_toll_entitlement(text,text,text,text,text,integer,timestamptz,text) from public,anon,authenticated;
revoke all on function public.consume_toll_entitlement(text,text,integer) from public,anon,authenticated;
revoke all on function public.record_toll_call(text,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.upsert_toll_entitlement(text,text,text,text,text,integer,timestamptz,text) to service_role;
grant execute on function public.consume_toll_entitlement(text,text,integer) to service_role;
grant execute on function public.record_toll_call(text,text,text,text,jsonb) to service_role;
