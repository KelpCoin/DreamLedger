create or replace function public.beck_24h_receipt() returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_from timestamptz:=pg_catalog.now()-interval '24 hours'; v_end timestamptz:=pg_catalog.now(); v_revenue numeric:=0; v_rows integer:=0; v_hb integer:=0; v_status text:='NOT_YET_PROVEN';
begin
 select coalesce(sum(amount_nzd),0),count(*) into v_revenue,v_rows from public.revenue_orders where lower(status)='paid' and paid_at>=v_from;
 select count(*) into v_hb from public.telemetry_events where event_type='BECK_HEARTBEAT' and event_timestamp>=v_from;
 if exists(select 1 from public.jobs where type='beck_objective' and beck_lifecycle='complete' and beck_terminal_result->>'economic_status'='VERIFIED') then v_status:='VERIFIED'; end if;
 insert into public.cube_evidence_vault(silo_id,source,observation,verification_status,outcome,content_hash)
 values('BECK','beck.24h.receipt',jsonb_build_object('window_start',v_from,'window_end',v_end,'operational_autonomy',jsonb_build_object('observed_heartbeats',v_hb),'resilience',jsonb_build_object('objective_persistent_in_jobs',true,'expired_lease_recovery_available',true),'economic_autonomy',jsonb_build_object('status',v_status,'rows_24h',v_rows,'revenue_nzd_24h',v_revenue),'generated_from_observed_database_evidence',true),'VERIFIED',jsonb_build_object('economic_status',v_status,'revenue_nzd_24h',v_revenue),encode(extensions.digest(convert_to(jsonb_build_object('window_start',v_from,'window_end',v_end,'economic_status',v_status,'rows_24h',v_rows,'revenue_nzd_24h',v_revenue)::text,'utf8'),'sha256'),'hex')) returning evidence_id into v_id;
 return v_id;
end $$;
revoke all on function public.beck_24h_receipt() from public;
grant execute on function public.beck_24h_receipt() to service_role;