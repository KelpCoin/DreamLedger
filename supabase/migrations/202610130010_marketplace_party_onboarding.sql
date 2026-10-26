-- Atomic marketplace party applications and explicit human approval.
begin;
alter table public.marketplace_parties add column if not exists idempotency_key text;
create unique index if not exists marketplace_parties_application_idempotency_unique on public.marketplace_parties(idempotency_key) where idempotency_key is not null;

create or replace function public.marketplace_apply_party(
  p_idempotency_key text,p_party_type text,p_display_name text,p_country_code char(2),p_contact_email text,p_public_profile jsonb default '{}'::jsonb,p_application_notes text default null
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare prior public.marketplace_parties%rowtype; party public.marketplace_parties%rowtype; email_hash text;
begin
  perform pg_advisory_xact_lock(hashtext(p_idempotency_key));
  select * into prior from public.marketplace_parties where idempotency_key=p_idempotency_key;
  if found then return jsonb_build_object('party_id',prior.id,'status',prior.status,'trust_state',prior.trust_state,'duplicate',true); end if;
  if p_party_type not in ('business','human') then raise exception 'party_type must be business or human'; end if;
  if length(trim(coalesce(p_display_name,''))) not between 2 and 160 then raise exception 'display_name must be 2-160 characters'; end if;
  if upper(p_country_code)!~'^[A-Z]{2}$' then raise exception 'country code must be ISO alpha-2'; end if;
  if trim(coalesce(p_contact_email,''))!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'valid contact email required'; end if;
  email_hash:=encode(digest(convert_to(lower(trim(p_contact_email)),'UTF8'),'sha256'),'hex');
  insert into public.marketplace_parties(idempotency_key,party_type,display_name,country_code,contact_email,public_profile,application_notes,status,trust_state)
  values(p_idempotency_key,p_party_type,trim(p_display_name),upper(p_country_code),lower(trim(p_contact_email)),coalesce(p_public_profile,'{}'::jsonb),left(coalesce(p_application_notes,''),2000),'pending','UNVERIFIED')
  returning * into party;
  perform public.marketplace_append_ledger_event(p_idempotency_key||':submitted','PARTY_APPLICATION_SUBMITTED','marketplace_party',party.id,'human',null,'OBSERVED',jsonb_build_object('party_type',party.party_type,'country_code',party.country_code,'contact_email_sha256',email_hash,'trust_state','UNVERIFIED'));
  return jsonb_build_object('party_id',party.id,'status',party.status,'trust_state',party.trust_state,'duplicate',false,'message','Application received; account access is pending review and identity is not verified.');
end; $$;

create or replace function public.marketplace_approve_party(
  p_idempotency_key text,p_party_id uuid,p_reviewed_by text,p_email_verified boolean,p_authority_confirmed boolean
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare party public.marketplace_parties%rowtype;
begin
  if coalesce(length(trim(p_idempotency_key)),0)<12 then raise exception 'idempotency key required'; end if;
  if p_email_verified is not true or p_authority_confirmed is not true or coalesce(length(trim(p_reviewed_by)),0)<3 then raise exception 'email verification, authority confirmation and reviewer are required'; end if;
  select * into party from public.marketplace_parties where id=p_party_id for update;
  if not found then raise exception 'party not found'; end if;
  if party.status='active' then return jsonb_build_object('party_id',party.id,'status','active','trust_state',party.trust_state,'duplicate',true); end if;
  if party.status<>'pending' then raise exception 'only pending parties can be approved'; end if;
  update public.marketplace_parties set status='active',contact_email_verified_at=now(),application_notes=concat_ws(E'\n',application_notes,'Approved by '||left(p_reviewed_by,160)||' at '||now()::text),updated_at=now() where id=party.id returning * into party;
  perform public.marketplace_append_ledger_event(p_idempotency_key,'PARTY_APPLICATION_APPROVED','marketplace_party',party.id,'human',left(p_reviewed_by,160),'OBSERVED',jsonb_build_object('contact_email_verified',true,'authority_confirmed',true,'trust_state',party.trust_state));
  return jsonb_build_object('party_id',party.id,'status',party.status,'trust_state',party.trust_state,'duplicate',false,'message','Access enabled; trust_state remains UNVERIFIED until separate evidence review.');
end; $$;

revoke all on function public.marketplace_apply_party(text,text,text,char,text,jsonb,text) from public,anon,authenticated;
revoke all on function public.marketplace_approve_party(text,uuid,text,boolean,boolean) from public,anon,authenticated;
grant execute on function public.marketplace_apply_party(text,text,text,char,text,jsonb,text) to service_role;
grant execute on function public.marketplace_approve_party(text,uuid,text,boolean,boolean) to service_role;
commit;
