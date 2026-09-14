begin;

create or replace function public.record_economic_outcome(
  p_offer_id uuid,
  p_outcome_type text,
  p_amount_nzd numeric default 0,
  p_external_reference text default null,
  p_evidence_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_outcome_id uuid;
  v_candidate_id uuid;
  v_action_id uuid;
  v_existing uuid;
begin
  if p_outcome_type not in ('PAYMENT_ATTEMPT','PAID','REFUNDED','FULFILLED','REPEAT_PURCHASE') then
    raise exception 'unsupported economic outcome type: %', p_outcome_type;
  end if;

  select eo.outcome_id into v_existing
    from public.economic_outcomes eo
   where p_external_reference is not null
     and eo.external_reference = p_external_reference
     and eo.outcome_type = p_outcome_type
   limit 1;

  if v_existing is not null then
    return v_existing;
  end if;

  select ea.candidate_id, ea.action_id into v_candidate_id, v_action_id
    from public.economic_actions ea
   where ea.offer_id = p_offer_id
   order by ea.created_at desc nulls last
   limit 1;

  insert into public.economic_outcomes (
    candidate_id, action_id, offer_id, outcome_type,
    amount_nzd, founder_minutes, fulfilment_minutes,
    acquisition_cost_nzd, payment_fees_nzd, external_reference,
    observed_at, evidence_ids, metadata
  ) values (
    v_candidate_id, v_action_id, p_offer_id, p_outcome_type,
    coalesce(p_amount_nzd, 0), 0, 0, 0, 0, p_external_reference,
    now(),
    case when p_evidence_id is null then '{}'::text[] else array[p_evidence_id] end,
    coalesce(p_metadata, '{}'::jsonb)
      || jsonb_build_object('recorder', 'record_economic_outcome', 'schema_version', 1)
  )
  returning outcome_id into v_outcome_id;

  return v_outcome_id;
end;
$$;

revoke all on function public.record_economic_outcome(uuid,text,numeric,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.record_economic_outcome(uuid,text,numeric,text,text,jsonb) to service_role;

create unique index if not exists economic_outcomes_external_type_uq
  on public.economic_outcomes (external_reference, outcome_type)
  where external_reference is not null;

commit;
