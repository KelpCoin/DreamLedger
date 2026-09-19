-- BECK economic feedback controller
-- Canonical control/evidence remains Supabase.
alter table public.jobs add column if not exists economic_gate_status text default 'NO_REVENUE';
alter table public.jobs add column if not exists last_payment_check_at timestamptz;
alter table public.jobs drop constraint if exists jobs_economic_gate_status_check;
alter table public.jobs add constraint jobs_economic_gate_status_check
check (economic_gate_status in ('NO_REVENUE','REVENUE_DETECTED','FULFILMENT_INCOMPLETE','RECENTLY_CHECKED','REVENUE_PATH_CLEAR','NOT_ON_REVENUE_PATH'));

create or replace function public.evaluate_economic_gate(p_objective_id uuid,p_proposed_action text default null)
returns text language plpgsql security definer set search_path=''
as $$
declare v_count int:=0; v_last timestamptz; v_allowed boolean:=false;
begin
 select count(*) into v_count
 from public.economic_outcomes e
 where e.outcome_type='payment_received'
   and e.metadata->>'objective_key'=(select objective_key from public.jobs where id=p_objective_id);
 if v_count>0 then return 'REVENUE_DETECTED'; end if;
 select last_payment_check_at into v_last from public.jobs where id=p_objective_id;
 if v_last > now()-interval '1 hour' then return 'RECENTLY_CHECKED'; end if;
 v_allowed := coalesce(p_proposed_action,'') in
 ('find_candidate','build_deliverable','prepare_exposure','verify_checkout','inspect_attribution','reconcile_payment',
  'LOOP_001_OBSERVE','LOOP_002_NORMALIZE','LOOP_003_DEMAND_SCAN','LOOP_004_SYNTHESIZE',
  'INSPECT_CHECKOUT','RECONCILE_STRIPE','DIAGNOSE_ATTRIBUTION','VERIFY_FULFILLMENT');
 if not v_allowed then return 'NOT_ON_REVENUE_PATH'; end if;
 return 'REVENUE_PATH_CLEAR';
end $$;

-- The objective claim path must call evaluate_economic_gate before leasing.
-- Revenue detection terminates the objective; non-revenue-path actions are rejected.
