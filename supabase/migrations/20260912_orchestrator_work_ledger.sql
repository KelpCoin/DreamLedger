create table if not exists public.orchestrator_tasks (
  task_id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  parent_task_id uuid,
  role text not null,
  tier text not null check (tier in ('local','cloud')),
  objective text not null,
  input jsonb not null default '{}'::jsonb,
  required_output_schema text,
  timeout_seconds integer not null default 300 check (timeout_seconds > 0),
  max_turns integer not null default 10 check (max_turns > 0),
  max_tool_calls integer not null default 20 check (max_tool_calls > 0),
  max_cost_cents integer,
  status text not null default 'queued' check (status in ('queued','running','waiting_user','waiting_external','retry_scheduled','done','failed','timeout','cancelled')),
  lease_owner text,
  lease_token uuid,
  lease_expires_at timestamptz,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  retry_policy_json jsonb,
  next_retry_at timestamptz,
  waiting_kind text,
  waiting_ref text,
  claimed_by text,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  result jsonb,
  error text
);
create index if not exists idx_orchestrator_tasks_drain on public.orchestrator_tasks (tier,status,created_at) where status='queued';
create index if not exists idx_orchestrator_tasks_lease on public.orchestrator_tasks (status,lease_expires_at) where status='running';
create index if not exists idx_orchestrator_tasks_retry on public.orchestrator_tasks (status,next_retry_at) where status='retry_scheduled';
create or replace function public.claim_orchestrator_task(p_tier text,p_worker text,p_lease_seconds integer default 30) returns setof public.orchestrator_tasks language sql security definer set search_path='' as $$ update public.orchestrator_tasks set status='running',lease_owner=p_worker,lease_token=gen_random_uuid(),lease_expires_at=now()+make_interval(secs=>p_lease_seconds),claimed_by=p_worker,claimed_at=now(),started_at=coalesce(started_at,now()),attempt_count=attempt_count+1 where task_id=(select task_id from public.orchestrator_tasks where tier=p_tier and status='queued' order by created_at asc for update skip locked limit 1) returning *; $$;
create or replace function public.renew_orchestrator_task_lease(p_task_id uuid,p_lease_token uuid,p_worker text,p_lease_seconds integer default 30) returns boolean language sql security definer set search_path='' as $$ update public.orchestrator_tasks set lease_expires_at=now()+make_interval(secs=>p_lease_seconds) where task_id=p_task_id and lease_token=p_lease_token and lease_owner=p_worker and status='running' and lease_expires_at>now() returning true; $$;
create or replace function public.finish_orchestrator_task(p_task_id uuid,p_lease_token uuid,p_worker text,p_status text,p_result jsonb default null,p_error text default null) returns setof public.orchestrator_tasks language sql security definer set search_path='' as $$ update public.orchestrator_tasks set status=p_status,result=p_result,error=p_error,completed_at=case when p_status in ('done','failed','timeout','cancelled') then now() else completed_at end,lease_expires_at=null where task_id=p_task_id and lease_token=p_lease_token and lease_owner=p_worker returning *; $$;
create or replace function public.reap_orchestrator_tasks(p_now timestamptz default now()) returns integer language plpgsql security definer set search_path='' as $$ declare n integer; begin update public.orchestrator_tasks set status=case when attempt_count < coalesce((retry_policy_json->>'max_attempts')::integer,3) then 'retry_scheduled' else 'timeout' end,next_retry_at=case when attempt_count < coalesce((retry_policy_json->>'max_attempts')::integer,3) then p_now+make_interval(secs=>coalesce((retry_policy_json->>'backoff_seconds')::integer,30)) else null end,error=coalesce(error,'lease expired before terminal close-out'),lease_expires_at=null where status='running' and lease_expires_at is not null and lease_expires_at<=p_now; get diagnostics n=row_count; return n; end; $$;
revoke execute on function public.claim_orchestrator_task(text,text,integer) from public,anon,authenticated;
revoke execute on function public.renew_orchestrator_task_lease(uuid,uuid,text,integer) from public,anon,authenticated;
revoke execute on function public.finish_orchestrator_task(uuid,uuid,text,text,jsonb,text) from public,anon,authenticated;
revoke execute on function public.reap_orchestrator_tasks(timestamptz) from public,anon,authenticated;
grant execute on function public.claim_orchestrator_task(text,text,integer) to service_role;
grant execute on function public.renew_orchestrator_task_lease(uuid,uuid,text,integer) to service_role;
grant execute on function public.finish_orchestrator_task(uuid,uuid,text,text,jsonb,text) to service_role;
grant execute on function public.reap_orchestrator_tasks(timestamptz) to service_role;
alter table public.orchestrator_tasks enable row level security;
revoke all on public.orchestrator_tasks from anon,authenticated;
