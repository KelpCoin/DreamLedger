-- Atomically reconcile commerce cell state and its audit event.
-- The state update and event insert occur in one transaction so a failed event insert
-- cannot leave a state transition without its corresponding evidence row.
create or replace function public.apply_commerce_supervisor_transition(
  p_cell_id text,
  p_expected_state text,
  p_to_state text,
  p_reason text,
  p_evidence_ref text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  changed_cell_id text;
begin
  if p_cell_id is null or length(trim(p_cell_id)) = 0 then
    raise exception 'p_cell_id is required';
  end if;
  if p_expected_state is null or p_to_state is null then
    raise exception 'expected and target states are required';
  end if;
  if p_to_state not in ('PAID', 'FULFILLED') then
    raise exception 'Unsupported supervisor target state: %', p_to_state;
  end if;
  if p_expected_state = p_to_state then
    return false;
  end if;

  -- Use string literals in dynamic SQL so the assignment is cast to the actual
  -- state column type even if it is a PostgreSQL enum rather than text.
  execute format(
    'update public.commerce_cells
       set state = %L, updated_at = now()
     where cell_id::text = %L
       and state::text = %L
     returning cell_id::text',
    p_to_state, p_cell_id, p_expected_state
  ) into changed_cell_id;

  -- Optimistic concurrency guard: another worker/state transition won the race.
  if changed_cell_id is null then
    return false;
  end if;

  insert into public.commerce_cell_state_events
    (cell_id, from_state, to_state, reason, evidence_ref, actor)
  select c.cell_id, p_expected_state, p_to_state,
         p_reason, p_evidence_ref, 'commerce-supervisor'
    from public.commerce_cells c
   where c.cell_id::text = changed_cell_id;

  return true;
end;
$function$;

revoke all on function public.apply_commerce_supervisor_transition(text, text, text, text, text) from public;
revoke all on function public.apply_commerce_supervisor_transition(text, text, text, text, text) from anon, authenticated;
grant execute on function public.apply_commerce_supervisor_transition(text, text, text, text, text) to service_role;
