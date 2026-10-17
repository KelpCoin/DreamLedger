-- Follow-up contract: idempotent A2A intent and authorized ledger audit read.
begin;

alter table public.marketplace_agent_approvals
  add column if not exists idempotency_key text;
create unique index if not exists marketplace_agent_approvals_idempotency_unique
  on public.marketplace_agent_approvals(idempotency_key) where idempotency_key is not null;

create or replace function public.marketplace_record_agent_intent(
  p_idempotency_key text,p_agent_uri text,p_principal_party_id uuid,p_action text,p_request jsonb,p_spend_minor bigint default 0,p_currency char(3) default 'NZD'
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare principal public.marketplace_agent_principals%rowtype; request_hash text; approval public.marketplace_agent_approvals%rowtype; prior public.marketplace_agent_approvals%rowtype;
begin
  if coalesce(length(trim(p_idempotency_key)),0)<12 then raise exception 'idempotency key must be at least 12 chars'; end if;
  select * into prior from public.marketplace_agent_approvals where idempotency_key=p_idempotency_key;
  if found then return jsonb_build_object('approval_id',prior.id,'state',prior.status,'request_hash',prior.request_hash,'expires_at',prior.expires_at,'execution_authorized',false,'duplicate',true); end if;
  select * into principal from public.marketplace_agent_principals where agent_uri=p_agent_uri and principal_party_id=p_principal_party_id and status='active' and (expires_at is null or expires_at>now()) for update;
  if not found then raise exception 'agent principal is not active or not authorized'; end if;
  if not (p_action = any(principal.authority_scope)) then raise exception 'action outside principal authority scope'; end if;
  if p_spend_minor<0 or p_spend_minor>principal.max_spend_minor then raise exception 'spend exceeds principal limit'; end if;
  request_hash:=encode(digest(convert_to(coalesce(p_request,'{}'::jsonb)::text,'UTF8'),'sha256'),'hex');
  insert into public.marketplace_agent_approvals(idempotency_key,agent_principal_id,action,amount_minor,currency,request_hash,expires_at,status)
  values(p_idempotency_key,principal.id,p_action,p_spend_minor,upper(p_currency),request_hash,now()+interval '15 minutes','pending')
  on conflict(idempotency_key) do nothing returning * into approval;
  if approval.id is null then
    select * into prior from public.marketplace_agent_approvals where idempotency_key=p_idempotency_key;
    return jsonb_build_object('approval_id',prior.id,'state',prior.status,'request_hash',prior.request_hash,'expires_at',prior.expires_at,'execution_authorized',false,'duplicate',true);
  end if;
  perform public.marketplace_append_ledger_event(p_idempotency_key,'A2A_INTENT_RECORDED','agent_approval',approval.id,'agent',p_agent_uri,'OBSERVED',jsonb_build_object('action',p_action,'request_hash',request_hash,'spend_minor',p_spend_minor,'currency',upper(p_currency),'human_approval_required',principal.requires_human_approval or p_spend_minor>0));
  return jsonb_build_object('approval_id',approval.id,'state','PENDING_HUMAN_APPROVAL','request_hash',request_hash,'expires_at',approval.expires_at,'execution_authorized',false,'duplicate',false);
end; $$;

create or replace function public.marketplace_audit_ledger(p_limit integer default 50)
returns setof jsonb language sql stable security definer set search_path=public,pg_temp as $$
  select jsonb_build_object('sequence_id',e.sequence_id,'event_id',e.event_id,'idempotency_key',e.idempotency_key,'event_type',e.event_type,'subject_type',e.subject_type,'subject_id',e.subject_id,'actor_type',e.actor_type,'actor_id',e.actor_id,'economic_state',e.economic_state,'payload',e.payload,'evidence_ids',e.evidence_ids,'previous_hash',e.previous_hash,'event_hash',e.event_hash,'occurred_at',e.occurred_at,'recorded_at',e.recorded_at)
  from public.marketplace_ledger_events e order by e.sequence_id desc limit least(greatest(coalesce(p_limit,50),1),100);
$$;

revoke all on function public.marketplace_record_agent_intent(text,text,uuid,text,jsonb,bigint,char) from public,anon,authenticated;
revoke all on function public.marketplace_audit_ledger(integer) from public,anon,authenticated;
grant execute on function public.marketplace_record_agent_intent(text,text,uuid,text,jsonb,bigint,char) to service_role;
grant execute on function public.marketplace_audit_ledger(integer) to service_role;
commit;
