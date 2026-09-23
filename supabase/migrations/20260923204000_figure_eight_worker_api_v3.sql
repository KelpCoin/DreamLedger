-- Figure Eight v3 API hardening: evidence attachment and replication scan.
create or replace function public.figure_eight_worker_api(
  p_worker text,
  p_operation text,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security invoker
as $$
declare
  result jsonb;
  c figure_eight.economic_cells%rowtype;
  arr jsonb;
begin
  if current_user <> 'service_role' then
    raise exception 'FIGURE_EIGHT_AUTH: service_role required';
  end if;

  if p_operation='ATTACH_CELL_EVIDENCE' then
    if coalesce(p_payload->>'cell_id','')='' then raise exception 'cell_id required'; end if;
    if coalesce(p_payload->'patch','null'::jsonb)='null'::jsonb then raise exception 'patch required'; end if;
    update figure_eight.economic_cells
       set state_evidence = state_evidence || (p_payload->'patch'),
           updated_at = now()
     where cell_id=(p_payload->>'cell_id')::uuid
     returning * into c;
    if not found then return jsonb_build_object('ok',false,'reason','CELL_NOT_FOUND'); end if;
    return jsonb_build_object('ok',true,'cell',to_jsonb(c));
  end if;

  if p_operation='MATERIALIZE_REV_ATOM' then
    return figure_eight.materialize_rev_atom((p_payload->>'cell_id')::uuid);
  end if;

  if p_operation='REPLICATOR_SCAN' then
    return figure_eight.replicator_scan(
      (p_payload->>'mechanism_id')::uuid,
      coalesce((p_payload->>'min_score')::numeric,0.60),
      coalesce((p_payload->>'limit')::integer,25)
    );
  end if;

  if p_operation='SEO_RELEASE_CHECK' then
    return figure_eight.seo_release_gate((p_payload->>'seo_opportunity_id')::uuid);
  end if;

  if p_operation='MECHANISM_RECORD_VERIFIED' then
    update figure_eight.mechanism_candidates
       set status='VERIFIED'
     where mechanism_candidate_id=(p_payload->>'mechanism_id')::uuid
       and exists (
         select 1 from figure_eight.rev_atoms r
         where r.rev_atom_id=figure_eight.mechanism_candidates.rev_atom_id
           and r.truth_status='VERIFIED'
       )
     returning * into c;
    if not found then
      return jsonb_build_object('ok',false,'reason','REV_ATOM_NOT_VERIFIED');
    end if;
    return jsonb_build_object('ok',true,'mechanism_id',p_payload->>'mechanism_id','status','VERIFIED');
  end if;

  raise exception 'Unsupported v3 Figure Eight worker operation: %', p_operation;
end;
$$;

comment on function public.figure_eight_worker_api(text,text,jsonb)
is 'Figure Eight private worker control surface. v3 operations extend the v2 surface.';
