-- Economic task lease and prediction guardrails.
-- Keeps task status aligned with the existing status CHECK (pending/leased/completed/failed/cancelled).
-- Predictions may only be scored once and only inside their declared observation window.

create or replace function public.claim_economic_model_task(
  p_task_id uuid,
  p_lease_seconds integer default 300
) returns public.economic_model_tasks
language plpgsql security definer set search_path=public as $$
declare
  v_task public.economic_model_tasks;
begin
  if p_lease_seconds < 30 or p_lease_seconds > 3600 then
    raise exception 'invalid lease seconds';
  end if;

  update public.economic_model_tasks
     set status='leased',
         attempt_count=attempt_count+1,
         started_at=coalesce(started_at,now()),
         leased_until=now()+make_interval(secs=>p_lease_seconds),
         last_error=null
   where task_id=p_task_id
     and status in ('pending','leased')
     and (status='pending' or leased_until is null or leased_until<now())
   returning * into v_task;

  if v_task.task_id is null then
    raise exception 'task unavailable or lease active';
  end if;
  return v_task;
end;
$$;

create or replace function public.requeue_expired_economic_model_tasks()
returns integer
language plpgsql security definer set search_path=public as $$
declare
  v_count integer;
begin
  update public.economic_model_tasks
     set status='pending',
         leased_until=null,
         last_error=coalesce(last_error,'') ||
           case when coalesce(last_error,'')='' then '' else E'\n' end ||
           'LEASE_EXPIRED:' || now()::text
   where status='leased'
     and leased_until is not null
     and leased_until<now();
  get diagnostics v_count=row_count;
  return v_count;
end;
$$;

create or replace function public.score_economic_prediction(
  p_prediction_id uuid,
  p_observed boolean,
  p_observed_at timestamptz default now()
) returns public.economic_predictions
language plpgsql security definer set search_path=public as $$
declare
  v_row public.economic_predictions;
  v_error numeric;
begin
  select * into v_row
    from public.economic_predictions
   where prediction_id=p_prediction_id
   for update;

  if v_row.prediction_id is null then
    raise exception 'prediction not found';
  end if;
  if v_row.status <> 'PREDICTED' then
    raise exception 'prediction not scoreable in status %',v_row.status;
  end if;
  if p_observed_at < v_row.prediction_window_start
     or p_observed_at > v_row.prediction_window_end then
    raise exception 'observed_at outside prediction window';
  end if;

  v_error := abs(v_row.predicted_probability - case when p_observed then 1 else 0 end);

  update public.economic_predictions
     set status=case when p_observed then 'CONFIRMED' else 'WRONG' end,
         observed_probability=case when p_observed then 1 else 0 end,
         calibration_error=v_error,
         resolved_at=p_observed_at
   where prediction_id=p_prediction_id
   returning * into v_row;

  return v_row;
end;
$$;
