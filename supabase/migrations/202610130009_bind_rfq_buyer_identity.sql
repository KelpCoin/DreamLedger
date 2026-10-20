-- Bind authenticated buyer RFQs to the buyer party so offers can only be accepted by their intended buyer.
begin;
drop function if exists public.marketplace_create_public_rfq(text,text,text,text,bigint,bigint,char,timestamptz,jsonb,jsonb,text);
create or replace function public.marketplace_create_public_rfq(
  p_idempotency_key text, p_title text, p_problem text, p_category text, p_budget_min_minor bigint default null,
  p_budget_max_minor bigint default null, p_currency char(3) default 'NZD', p_needed_by timestamptz default null,
  p_region jsonb default '{}'::jsonb, p_constraints jsonb default '{}'::jsonb, p_source_ref text default null,
  p_buyer_party_id uuid default null
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare req public.marketplace_requirements%rowtype; rfq public.marketplace_rfqs%rowtype; prior jsonb; buyer public.marketplace_parties%rowtype;
begin
  if length(trim(coalesce(p_title,''))) not between 4 and 180 then raise exception 'title must be 4-180 characters'; end if;
  if length(trim(coalesce(p_problem,''))) not between 10 and 5000 then raise exception 'problem must be 10-5000 characters'; end if;
  if length(trim(coalesce(p_category,''))) not between 2 and 80 then raise exception 'category required'; end if;
  if coalesce(length(trim(p_idempotency_key)),0)<12 then raise exception 'idempotency key must be at least 12 chars'; end if;
  if p_buyer_party_id is not null then
    select * into buyer from public.marketplace_parties where id=p_buyer_party_id and status='active' and party_type in ('business','human');
    if not found then raise exception 'active buyer party required'; end if;
  end if;
  select response_body into prior from public.marketplace_idempotency where idempotency_key=p_idempotency_key;
  if found then return prior || jsonb_build_object('duplicate',true); end if;
  insert into public.marketplace_requirements(source_type,buyer_party_id,source_ref,title,problem_statement,category,budget_min_minor,budget_max_minor,currency,needed_by,delivery_region,constraints,demand_state,authorization_state,status)
  values('human',p_buyer_party_id,left(coalesce(p_source_ref,''),500),trim(p_title),trim(p_problem),lower(trim(p_category)),p_budget_min_minor,p_budget_max_minor,upper(coalesce(p_currency,'NZD')),p_needed_by,coalesce(p_region,'{}'::jsonb),coalesce(p_constraints,'{}'::jsonb),'OBSERVED',case when p_buyer_party_id is null then 'UNAUTHORIZED' else 'AUTHORIZED' end,'open') returning * into req;
  insert into public.marketplace_rfqs(requirement_id,buyer_party_id,title,scope,status,published_at)
  values(req.id,p_buyer_party_id,req.title,jsonb_build_object('problem',req.problem_statement,'category',req.category,'region',req.delivery_region,'constraints',req.constraints),'published',now()) returning * into rfq;
  perform public.marketplace_append_ledger_event(p_idempotency_key||':observed','RFQ_SUBMITTED','rfq',rfq.id,case when p_buyer_party_id is null then 'human' else 'business' end,coalesce(p_buyer_party_id::text,null),'OBSERVED',jsonb_build_object('requirement_id',req.id,'source_ref',req.source_ref,'budget_min_minor',req.budget_min_minor,'budget_max_minor',req.budget_max_minor,'buyer_party_id',p_buyer_party_id));
  insert into public.marketplace_idempotency(idempotency_key,request_hash,response_body)
  values(p_idempotency_key,encode(digest(convert_to(jsonb_build_object('title',p_title,'problem',p_problem,'category',p_category,'budget_min_minor',p_budget_min_minor,'budget_max_minor',p_budget_max_minor,'buyer_party_id',p_buyer_party_id)::text,'UTF8'),'sha256'),'hex'),jsonb_build_object('rfq_id',rfq.id,'requirement_id',req.id,'state','OBSERVED','message','RFQ received for review; supplier responses are not guaranteed'));
  return jsonb_build_object('rfq_id',rfq.id,'requirement_id',req.id,'state','OBSERVED','message','RFQ received for review; supplier responses are not guaranteed','duplicate',false);
end; $$;
revoke all on function public.marketplace_create_public_rfq(text,text,text,text,bigint,bigint,char,timestamptz,jsonb,jsonb,text,uuid) from public,anon,authenticated;
grant execute on function public.marketplace_create_public_rfq(text,text,text,text,bigint,bigint,char,timestamptz,jsonb,jsonb,text,uuid) to service_role;
commit;
