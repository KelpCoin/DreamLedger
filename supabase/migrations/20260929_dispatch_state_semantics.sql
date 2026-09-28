-- Clarify DISPATCHED semantics without changing economic truth.
-- DISPATCHED historically mixed internal routing with blocked external attempts.
-- dispatch_state is now the authoritative interpretation layer.
alter table public.economic_execution_packets
  add column if not exists dispatch_state text;
update public.economic_execution_packets
set dispatch_state = case
  when status='DISPATCHED' and authorization_decision_id is null then 'EXTERNAL_BLOCKED'
  when status='DISPATCHED' and authorization_decision_id is not null and authorization_verdict='allow' then 'INTERNAL_ROUTED'
  when status='DISPATCHED' then 'UNKNOWN'
  else coalesce(dispatch_state,'NOT_DISPATCHED')
end;
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='economic_execution_packets_dispatch_state_chk'
  ) then
    alter table public.economic_execution_packets
      add constraint economic_execution_packets_dispatch_state_chk
      check (dispatch_state in (
        'NOT_DISPATCHED',
        'INTERNAL_ROUTED',
        'EXTERNAL_BLOCKED',
        'EXTERNAL_SENT',
        'EXTERNAL_RESULT_OBSERVED',
        'UNKNOWN'
      ));
  end if;
end $$;
