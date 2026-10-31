-- MTG physical-evidence boundary: real private image bytes + server hash before inventory submission.
-- Additive only. No public object access and no seller self-approval.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('mtg-auction-evidence','mtg-auction-evidence',false,5242880,array['image/jpeg','image/png','image/webp'])
 on conflict(id) do nothing;

create table if not exists public.mtg_auction_evidence_v2 (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete restrict,
 sha256 text not null check(sha256 ~ '^[0-9a-f]{64}$'),
 storage_key text not null unique,
 content_type text not null check(content_type in ('image/jpeg','image/png','image/webp')),
 byte_size integer not null check(byte_size between 32 and 5242880),
 created_at timestamptz not null default now(),
 unique(owner_id,sha256)
);
alter table public.mtg_auction_evidence_v2 enable row level security;
revoke all on public.mtg_auction_evidence_v2 from public, anon, authenticated;
grant select,insert on public.mtg_auction_evidence_v2 to service_role;
alter table public.mtg_inventory_v2 add column if not exists evidence_id uuid
 references public.mtg_auction_evidence_v2(id);
create unique index if not exists mtg_inventory_evidence_single_use_v2
 on public.mtg_inventory_v2(evidence_id) where evidence_id is not null;

-- Direct session callers never write a checksum-only inventory record.
create or replace function public.mtg_inventory_submit_v2(
 p_title text,p_condition text,p_evidence_sha256 text)
returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); e public.mtg_auction_evidence_v2%rowtype; result uuid;
begin
 if u is null then raise exception 'AUTH_REQUIRED'; end if;
 if not exists(select 1 from public.mtg_seller_profiles_v2
 where user_id=u and status<>'suspended') then raise exception 'SELLER_ACCOUNT_REQUIRED'; end if;
 if length(trim(coalesce(p_title,''))) not between 3 and 180
 or length(trim(coalesce(p_condition,''))) not between 2 and 100
 or coalesce(p_evidence_sha256,'') !~ '^[0-9a-f]{64}$'
 then raise exception 'INVALID_INVENTORY'; end if;
 select * into e from public.mtg_auction_evidence_v2
 where owner_id=u and sha256=p_evidence_sha256 for update;
 if not found then raise exception 'ORIGINAL_IMAGE_UPLOAD_REQUIRED'; end if;
 insert into public.mtg_inventory_v2(seller_id,title,condition,evidence_sha256,evidence_id)
 values(u,trim(p_title),trim(p_condition),e.sha256,e.id) returning id into result;
 return result;
end $$;
revoke execute on function public.mtg_inventory_submit_v2(text,text,text) from public, anon;
grant execute on function public.mtg_inventory_submit_v2(text,text,text) to authenticated;

create or replace function public.mtg_inventory_verify_v2(p_inventory uuid,p_sha text)
returns void language plpgsql security definer set search_path='' as $$
declare i public.mtg_inventory_v2%rowtype;
begin
 select * into i from public.mtg_inventory_v2 where id=p_inventory for update;
 if not found or i.status<>'pending' or i.evidence_sha256<>p_sha
 or not exists(select 1 from public.mtg_auction_evidence_v2 e
 where e.id=i.evidence_id and e.owner_id=i.seller_id and e.sha256=i.evidence_sha256)
 or not exists(select 1 from public.mtg_seller_profiles_v2 s
 where s.user_id=i.seller_id and s.status='verified')
 then raise exception 'INVENTORY_NOT_VERIFIABLE'; end if;
 update public.mtg_inventory_v2 set status='verified',verified_at=now() where id=i.id;
end $$;
revoke all on function public.mtg_inventory_verify_v2(uuid,text) from public, anon, authenticated;
grant execute on function public.mtg_inventory_verify_v2(uuid,text) to service_role;
