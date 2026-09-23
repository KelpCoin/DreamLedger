-- Figure Eight Runtime Workers v3: materialization, replication scan, and hardening.
create or replace function figure_eight.materialize_rev_atom(p_cell_id uuid)
returns jsonb
language plpgsql
as $$
declare
  c figure_eight.economic_cells%rowtype;
  v figure_eight.verification_fossils%rowtype;
  r figure_eight.rev_atoms%rowtype;
  payload jsonb;
  h text;
begin
  select * into c from figure_eight.economic_cells where cell_id=p_cell_id;
  if not found then return jsonb_build_object('ok',false,'reason','CELL_NOT_FOUND'); end if;
  if c.state <> 'INDEPENDENTLY_VERIFIED' then
    return jsonb_build_object('ok',false,'reason','CELL_NOT_INDEPENDENTLY_VERIFIED');
  end if;

  select * into v
  from figure_eight.verification_fossils
  where cell_id=p_cell_id and verdict='VERIFIED' and provenance='OBSERVED'
  order by created_at desc limit 1;

  if not found then
    return jsonb_build_object('ok',false,'reason','NO_OBSERVED_VERIFICATION_FOSSIL');
  end if;

  payload := jsonb_build_object(
    'cell_id',p_cell_id,
    'truth_status','VERIFIED',
    'external_buyer',coalesce(c.state_evidence->'external_buyer','{}'::jsonb),
    'settlement',coalesce(c.state_evidence->'settlement','{}'::jsonb),
    'attribution',coalesce(c.state_evidence->'attribution','{}'::jsonb),
    'fulfillment',coalesce(c.state_evidence->'fulfillment','{}'::jsonb),
    'independent_verification',jsonb_build_object(
      'verified',true,
      'verification_fossil_id',v.verification_fossil_id,
      'provenance',v.provenance,
      'source',v.source,
      'raw_response_sha256',v.raw_response_sha256,
      'verdict_input',v.verdict_input
    ),
    'signal_pattern',coalesce(c.state_evidence->'signal_pattern','{}'::jsonb),
    'proposition_pattern',coalesce(c.state_evidence->'proposition_pattern','{}'::jsonb),
    'proof_pattern',coalesce(c.state_evidence->'proof_pattern','{}'::jsonb)
  );
  h := encode(digest(payload::text,'sha256'),'hex');

  insert into figure_eight.rev_atoms(
    cell_id,truth_status,external_buyer,settlement,attribution,fulfillment,
    independent_verification,signal_pattern,proposition_pattern,proof_pattern,content_hash
  )
  values(
    p_cell_id,'VERIFIED',
    payload->'external_buyer',payload->'settlement',payload->'attribution',
    payload->'fulfillment',payload->'independent_verification',
    payload->'signal_pattern',payload->'proposition_pattern',payload->'proof_pattern',h
  )
  on conflict(cell_id) do nothing
  returning * into r;

  if not found then
    select * into r from figure_eight.rev_atoms where cell_id=p_cell_id;
  end if;

  return jsonb_build_object('ok',true,'rev_atom',to_jsonb(r));
end;
$$;

create or replace function figure_eight.replicator_scan(p_mechanism_id uuid, p_min_score numeric default 0.60, p_limit integer default 25)
returns jsonb
language plpgsql
stable
as $$
declare
  m figure_eight.mechanism_candidates%rowtype;
  rows jsonb := '[]'::jsonb;
begin
  select * into m
  from figure_eight.mechanism_candidates
  where mechanism_candidate_id=p_mechanism_id
    and status='VERIFIED';

  if not found then
    return jsonb_build_object('ok',false,'reason','MECHANISM_NOT_VERIFIED');
  end if;

  select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) into rows
  from (
    select opportunity_id,silo_id,
      greatest(
        case when lower(coalesce(evidence->>'intent_type','')) = lower(coalesce(m.signal_pattern->>'intent_type','')) then 0.25 else 0 end,
        0
      ) +
      case when lower(coalesce(source,'')) = lower(coalesce(m.signal_pattern->>'source','')) then 0.20 else 0 end +
      case when position(lower(coalesce(m.signal_pattern->>'subject','')) in lower(coalesce(subject,''))) > 0
           or position(lower(coalesce(subject,'')) in lower(coalesce(m.signal_pattern->>'subject',''))) > 0
           then 0.30 else 0 end +
      greatest(0, least(0.25, coalesce(confidence,0)::numeric * 0.25)) as score,
      jsonb_build_object(
        'intent_type', lower(coalesce(evidence->>'intent_type','')) = lower(coalesce(m.signal_pattern->>'intent_type','')),
        'source', lower(coalesce(source,'')) = lower(coalesce(m.signal_pattern->>'source','')),
        'subject_overlap', (
          position(lower(coalesce(m.signal_pattern->>'subject','')) in lower(coalesce(subject,''))) > 0
          or position(lower(coalesce(subject,'')) in lower(coalesce(m.signal_pattern->>'subject',''))) > 0
        ),
        'confidence', confidence
      ) matched_fields,
      jsonb_build_array(coalesce(evidence,'{}'::jsonb),coalesce(outputs,'{}'::jsonb)) evidence_refs
    from public.cube_opportunities
    where status not in ('REJECTED','RETIRED')
    order by score desc, created_at desc
    limit greatest(1,least(100,p_limit))
  ) q
  where q.score >= greatest(0,least(1,p_min_score));

  return jsonb_build_object('ok',true,'mechanism_id',p_mechanism_id,'candidates',rows);
end;
$$;

alter table figure_eight.economic_outbox
  add column if not exists locked_at timestamptz,
  add column if not exists locked_by text;

alter table figure_eight.economic_cells
  add column if not exists correlation_key text;

create unique index if not exists economic_cells_correlation_key_uq
  on figure_eight.economic_cells(correlation_key)
  where correlation_key is not null;

-- Tighten crossing grants. Append-only tables need no update privilege.
revoke update, delete on figure_eight.sales_events from service_role;
revoke update, delete on figure_eight.processed_events from service_role;
revoke update, delete on figure_eight.reconciliation_events from service_role;
revoke update, delete on figure_eight.verification_fossils from service_role;
revoke update, delete on figure_eight.rev_atoms from service_role;
revoke update, delete on figure_eight.cell_transitions from service_role;
revoke update, delete on figure_eight.seo_publication_events from service_role;

-- Make promotion mutations explicit and bounded.
revoke delete on figure_eight.offer_promotions from service_role;

comment on table figure_eight.sales_events is 'Figure Eight crossing A->B. Append-only. Loop A writes, Loop B reads.';
comment on table figure_eight.offer_promotions is 'Figure Eight crossing B->A. Promotion proposals only. Loop B writes, Loop A reads.';
comment on table figure_eight.processed_events is 'Durable idempotency ledger. Append-only.';
