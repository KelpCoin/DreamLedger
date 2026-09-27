-- Close remaining direct economic authorization path.
-- Every economic packet authorization decision must pass through the canonical PDP.

create or replace function public.economic_operating_tick(p_batch integer default 8)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  s record;
  v_opp uuid;
  v_cap text;
  v_packet uuid;
  v_qualified integer:=0;
  v_rejected integer:=0;
  v_ready integer:=0;
  v_scans integer:=0;
  v_now timestamptz:=now();
  v_auth jsonb;
begin
  if p_batch<1 or p_batch>50 then raise exception 'batch must be 1..50'; end if;
  perform public.reclaim_expired_jobs();

  insert into public.jobs(type,payload,status,attempt_count,objective_text,success_condition,failure_condition,authority_policy,budget_policy,current_state,next_action)
  select 'EXTERNAL_DEMAND_SCAN',jsonb_build_object('adapter_id',a.adapter_id,'source_type',a.source_type,'source_contract',a.source_contract,'silo_id',a.source_contract->>'silo_id'),'pending',0,
    'Find fresh external demand signals and write only evidence-backed candidate signals into public.economic_demand_signals.',
    '{"signal_written":true,"source_evidence":true,"no_external_action":true}'::jsonb,'{"source_unavailable":true,"evidence_missing":true}'::jsonb,
    '{"lane":"GREEN","external_effect":false}'::jsonb,'{"max_cost_nzd":0}'::jsonb,'pending',jsonb_build_object('capability',a.capability_id,'action_type','DISCOVER_DEMAND')
  from public.economic_demand_adapters a where a.enabled and (a.last_scheduled_at is null or a.last_scheduled_at<v_now-make_interval(mins=>a.cadence_minutes))
  and not exists(select 1 from public.jobs j where j.type='EXTERNAL_DEMAND_SCAN' and j.status in('pending','leased') and j.payload->>'adapter_id'=a.adapter_id) limit p_batch;
  get diagnostics v_scans=row_count;

  update public.economic_demand_adapters a set last_scheduled_at=v_now,updated_at=v_now where a.enabled and (a.last_scheduled_at is null or a.last_scheduled_at<v_now-make_interval(mins=>a.cadence_minutes));

  for s in select d.* from public.economic_demand_signals d where d.status in('ROUTED','UNROUTED') and d.silo_id='SILO_GENERAL' order by d.buyer_intent desc,d.evidence_score desc,d.observed_at desc limit p_batch loop
    select opportunity_id into v_opp from public.cube_opportunities where opportunity_key='OPP-'||s.signal_id limit 1;

    if v_opp is null then
      insert into public.cube_opportunities(opportunity_key,silo_id,source,subject,observed_at,evidence,confidence,audience,commercial_relevance,recommended_action,status,outputs,expected_value_nzd,time_budget_minutes)
      values('OPP-'||s.signal_id,s.silo_id,s.source,s.problem_text,s.observed_at,jsonb_build_array(jsonb_build_object('source',s.source,'source_ref',s.source_ref,'observed_at',s.observed_at)),
      greatest(s.buyer_intent,s.evidence_score,s.fit_score),jsonb_build_object('source',s.source),greatest(s.buyer_intent,s.evidence_score,s.fit_score),'QUALIFY','DETECTED','[]'::jsonb,coalesce(s.estimated_value_nzd,0),30) returning opportunity_id into v_opp;
    end if;

    if s.buyer_intent>=.60 and s.freshness_score>=.75 and s.evidence_score>=.75 and s.fit_score>=.75 then
      v_qualified:=v_qualified+1;
      select r.lattice_id into v_cap from public.economic_offer_routes r where r.signal_id=s.signal_id and r.checkout_ready=true order by r.match_score desc limit 1;
      if v_cap is not null then
        select case when l.fulfillment_policy->>'engine_id' in('ENG-01','ENG-03','ENG-04','ENG-05','ENG-06') then 'beck-execution' else null end into v_cap from public.economic_offer_lattice l where l.lattice_id=v_cap;
      end if;

      if v_cap is null or not exists(select 1 from public.bec_capability_registry c where c.capability_id=v_cap and c.state='AVAILABLE') then
        update public.cube_opportunities set status='INTERESTING',qualification_reason='Demand qualifies but no currently available fulfillment capability is bound to the matched route.',required_capabilities=jsonb_build_array(jsonb_build_object('required','fulfillment_engine','source',s.source,'signal_id',s.signal_id)),last_evaluated_at=v_now,updated_at=v_now where opportunity_id=v_opp;
      else
        update public.cube_opportunities set status='VERIFIED',qualification_reason='Fresh, evidence-backed demand meets deterministic thresholds.',required_capabilities=jsonb_build_array(v_cap),expected_value_nzd=coalesce(s.estimated_value_nzd,0),last_evaluated_at=v_now,updated_at=v_now where opportunity_id=v_opp;

        v_auth:=public.evaluate_economic_authorization(
          'economic-operating-tick',
          'BUILD_EXECUTION_PACKET',
          v_opp::text,
          jsonb_build_object(
            'source',s.source,
            'source_ref',s.source_ref,
            'category','planning',
            'max_cost_nzd',0,
            'reversible',true,
            'signal_id',s.signal_id,
            'opportunity_id',v_opp
          )
        );

        if coalesce(v_auth->>'decision','DENY')='ALLOW' then
          begin
            v_packet:=public.create_economic_execution_packet(v_opp,'Execute the matched bounded capability against the observed external demand.',
            jsonb_build_object('action_type','BUILD_EXECUTION_PACKET','category','planning','reversible',true,'signal_id',s.signal_id,'source_ref',s.source_ref),
            jsonb_build_object('opportunity_id',v_opp,'expected_external_effect','fulfillment_or_buyer_response'),
            jsonb_build_object('must_return','observable_external_result_or_explicit_block'),v_cap,jsonb_build_object('max_cost_nzd',0,'time_budget_minutes',30),
            jsonb_build_array('capability_unverified','scope_expanded','counterparty_unknown','external_spend_required'),
            jsonb_build_object('required',true,'source_ref',s.source_ref,'truth_classification','VERIFIED_ONLY_FOR_OBSERVED_EXTERNAL_RESULT'));
            v_ready:=v_ready+1;
          exception when others then
            update public.cube_opportunities set status='DETECTED',qualification_reason=left(sqlerrm,500),updated_at=v_now where opportunity_id=v_opp;
          end;
        else
          update public.cube_opportunities set status='INTERESTING',qualification_reason='PDP denied or requires approval; no packet authorization created.',last_evaluated_at=v_now,updated_at=v_now where opportunity_id=v_opp;
        end if;
      end if;
    else
      v_rejected:=v_rejected+1;
      update public.cube_opportunities set status='DID_NOT_CONVERT',qualification_reason='Deterministic opportunity threshold not met.',last_evaluated_at=v_now,updated_at=v_now where opportunity_id=v_opp;
    end if;
  end loop;

  return jsonb_build_object('tick_at',v_now,'demand_scans_scheduled',v_scans,'qualified',v_qualified,'rejected',v_rejected,'ready_packets',v_ready,'business_truth',(select to_jsonb(b) from public.economic_business_truth b));
end;
$function$;

revoke all on function public.economic_operating_tick(integer) from public, anon, authenticated;
grant execute on function public.economic_operating_tick(integer) to service_role;
alter function public.economic_operating_tick(integer) set search_path = public, pg_temp;

comment on function public.economic_operating_tick(integer) is
'Routes packet authorization through evaluate_economic_authorization; legacy authorize_economic_action is never used as an independent decision path.';
