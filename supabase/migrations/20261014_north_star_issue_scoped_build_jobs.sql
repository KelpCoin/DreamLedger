-- Issue-scoped North Star build queue functions.
-- Source only. Do not apply this migration to production without release review.
begin;

create or replace function public.north_star_payload_matches_issue(p_payload jsonb, p_issue integer)
returns boolean
language sql
immutable
set search_path = public
as $$
  select coalesce((p_payload->>'task_issue') = p_issue::text, false)
    or coalesce((p_payload->>'issue_number') = p_issue::text, false)
    or coalesce((p_payload->>'github_issue') ~ ('/issues/' || p_issue::text || '/?$'), false)
    or coalesce((p_payload->>'issue_url') ~ ('/issues/' || p_issue::text || '/?$'), false)
    or coalesce((p_payload->>'github_issue_url') ~ ('/issues/' || p_issue::text || '/?$'), false)
    or coalesce((p_payload->>'task_id') ~ ('(^|[^0-9])ISSUE-' || p_issue::text || '([^0-9]|$)'), false)
    or coalesce((p_payload->'task'->>'task_issue') = p_issue::text, false)
    or coalesce((p_payload->'task'->>'github_issue') ~ ('/issues/' || p_issue::text || '/?$'), false)
    or coalesce((p_payload->'metadata'->>'task_issue') = p_issue::text, false);
$$;

create or replace function public.select_north_star_build_job(
  p_task_issue integer,
  p_worker_id text default 'north-star-preview'
)
returns public.jobs
language plpgsql
security definer
set search_path = public
as $$
declare v_job public.jobs%rowtype;
begin
  if p_task_issue not between 712 and 720 then
    raise exception 'NORTH_STAR_BUILD_ISSUE_NOT_ALLOWLISTED';
  end if;
  if coalesce(trim(p_worker_id), '') = '' then
    raise exception 'NORTH_STAR_WORKER_ID_REQUIRED';
  end if;

  select * into v_job
    from public.jobs j
   where j.status = 'queued'
     and public.north_star_payload_matches_issue(j.payload, p_task_issue)
   order by j.created_at asc nulls first, j.id asc
   limit 1;
  return v_job;
end;
$$;

create or replace function public.claim_north_star_build_job(
  p_task_issue integer,
  p_worker_id text,
  p_lease_seconds integer default 900
)
returns public.jobs
language plpgsql
security definer
set search_path = public
as $$
declare v_job public.jobs%rowtype;
begin
  if p_task_issue not between 712 and 720 then
    raise exception 'NORTH_STAR_BUILD_ISSUE_NOT_ALLOWLISTED';
  end if;
  if coalesce(trim(p_worker_id), '') !~ '^[A-Za-z0-9_-]{2,64}$' then
    raise exception 'NORTH_STAR_WORKER_ID_INVALID';
  end if;
  if p_lease_seconds < 60 or p_lease_seconds > 1800 then
    raise exception 'NORTH_STAR_BUILD_LEASE_OUT_OF_RANGE';
  end if;

  select * into v_job
    from public.jobs j
   where j.status = 'queued'
     and public.north_star_payload_matches_issue(j.payload, p_task_issue)
   order by j.created_at asc nulls first, j.id asc
   for update skip locked
   limit 1;

  if not found then return null; end if;

  update public.jobs
     set status = 'leased',
         worker_id = p_worker_id,
         started_at = coalesce(started_at, now() at time zone 'UTC'),
         leased_until = now() + make_interval(secs => p_lease_seconds),
         lease_token = gen_random_uuid(),
         attempt_count = coalesce(attempt_count, 0) + 1,
         last_progress_at = now(),
         current_state = 'NORTH_STAR_BUILD_IN_PROGRESS'
   where id = v_job.id
     and status = 'queued'
   returning * into v_job;

  if not found then return null; end if;
  return v_job;
end;
$$;

revoke all on function public.north_star_payload_matches_issue(jsonb, integer) from public, anon, authenticated;
revoke all on function public.select_north_star_build_job(integer, text) from public, anon, authenticated;
revoke all on function public.claim_north_star_build_job(integer, text, integer) from public, anon, authenticated;
grant execute on function public.select_north_star_build_job(integer, text) to service_role;
grant execute on function public.claim_north_star_build_job(integer, text, integer) to service_role;

commit;
