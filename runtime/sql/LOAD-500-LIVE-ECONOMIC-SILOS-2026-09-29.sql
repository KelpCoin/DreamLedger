-- ECONOMIC SILO LOAD: 500 LIVE SILOS
-- Generated 2026-09-29
-- Purpose: distribute EXISTING routed economic demand signals from SILO_GENERAL
-- across the existing CUBE-AUTO-0000485..CUBE-AUTO-0000984 silos.
-- No new demand is fabricated. QUARANTINED signals are untouched.
-- No revenue, payment, buyer, authorization, or outcome state is created.

begin;

with ranked as (
  select
    signal_id,
    row_number() over(order by signal_id) - 1 as rn
  from public.economic_demand_signals
  where silo_id = 'SILO_GENERAL'
    and status = 'ROUTED'
),
target as (
  select
    signal_id,
    'CUBE-AUTO-' || lpad((485 + (rn % 500))::text, 7, '0') as target_silo
  from ranked
)
update public.economic_demand_signals e
set silo_id = t.target_silo,
    updated_at = now()
from target t
where e.signal_id = t.signal_id;

commit;

-- Verification
select
  count(*) filter (where silo_id between 'CUBE-AUTO-0000485' and 'CUBE-AUTO-0000984') as loaded_signals,
  count(distinct silo_id) filter (where silo_id between 'CUBE-AUTO-0000485' and 'CUBE-AUTO-0000984') as loaded_silos
from public.economic_demand_signals
where silo_id like 'CUBE-AUTO-%';

select status, count(*) as n
from public.economic_demand_signals
where silo_id = 'SILO_GENERAL'
group by status
order by status;

select count(*) as economic_outcomes from public.economic_outcomes;
