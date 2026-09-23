-- Figure Eight v5: restore verified-mechanism discovery and preserve append-only grants.

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
  arr jsonb := '[]'::jsonb;
begin
  if current_user <> 'service_role' then
    raise exception 'FIGURE_EIGHT_AUTH: service_role required';
  end if;

  if p_operation='VERIFIED_MECHANISM_CANDIDATES' then
    select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) into arr
    from (
      select m.mechanism_candidate_id,
             r.cell_id,
             m.rev_atom_id,
             m.name,
             m.signal_pattern,
             m.proposition_pattern,
             m.price_pattern,
             m.channel_pattern
      from figure_eight.mechanism_candidates m
      join figure_eight.rev_atoms r on r.rev_atom_id=m.rev_atom_id
      where m.status='VERIFIED'
        and r.truth_status='VERIFIED'
      order by m.created_at
      limit greatest(1,least(100,coalesce((p_payload->>'limit')::int,25)))
    ) q;
    return jsonb_build_object('ok',true,'mechanisms',arr);
  end if;

  raise exception 'Use the restored v4 worker API for operation: %', p_operation;
end;
$$;

revoke update, delete on figure_eight.cell_transitions from service_role;
revoke update, delete on figure_eight.reconciliation_events from service_role;
revoke update, delete on figure_eight.verification_fossils from service_role;
revoke update, delete on figure_eight.rev_atoms from service_role;
revoke update, delete on figure_eight.sales_events from service_role;
revoke update, delete on figure_eight.processed_events from service_role;
revoke update, delete on figure_eight.seo_publication_events from service_role;
revoke update, delete on figure_eight.offer_promotions from service_role;

comment on function public.figure_eight_worker_api(text,text,jsonb)
is 'Figure Eight worker API extension: verified mechanism discovery. Apply after v4 restore.';
