create or replace function public.claim_cortex_builder_job(p_worker_id text, p_lease_seconds integer default 900)
returns public.jobs
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_job public.jobs;
begin
  if p_worker_id is null or pg_catalog.btrim(p_worker_id) = '' then
    raise exception 'p_worker_id is required';
  end if;
  if p_lease_seconds < 60 or p_lease_seconds > 3600 then
    raise exception 'p_lease_seconds must be between 60 and 3600';
  end if;

  with candidate as (
    select id
    from public.jobs
    where type = 'cortex_builder'
      and (
        status = 'pending'
        or (status = 'leased' and leased_until is not null and leased_until < pg_catalog.now())
      )
      and coalesce(attempt_count, 0) < 5
    order by case when status = 'leased' then 0 else 1 end, created_at, id
    for update skip locked
    limit 1
  )
  update public.jobs j
     set status = 'leased',
         worker_id = p_worker_id,
         lease_token = pg_catalog.gen_random_uuid(),
         leased_until = pg_catalog.now() + pg_catalog.make_interval(secs => p_lease_seconds),
         started_at = coalesce(j.started_at, pg_catalog.now()),
         attempt_count = coalesce(j.attempt_count, 0) + 1,
         completed_at = null,
         last_error = null
    from candidate c
   where j.id = c.id
  returning j.* into v_job;

  if not found then
    return null;
  end if;
  return v_job;
end;
$function$;

revoke all on function public.claim_cortex_builder_job(text, integer) from public;
grant execute on function public.claim_cortex_builder_job(text, integer) to service_role;
