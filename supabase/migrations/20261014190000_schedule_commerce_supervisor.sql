-- Durable supervisor schedule owned by Postgres, not GitHub Actions cron.
-- Store the existing legacy service_role JWT in Supabase Vault first:
--   name: dreamledger_supervisor_service_role_key
-- Never put that value in this file, Git, a workflow log, or chat.
-- The scheduled command fails visibly if the vault secret is absent.

create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault;

do $schedule$
declare
  prior_job_id bigint;
begin
  if to_regclass('cron.job') is null then
    raise exception 'pg_cron is unavailable; enable Supabase Cron before scheduling the cloud supervisor';
  end if;
  if to_regclass('vault.decrypted_secrets') is null then
    raise exception 'Supabase Vault is unavailable; enable Vault and create the supervisor key secret';
  end if;
  if to_regclass('net._http_response') is null then
    raise exception 'pg_net is unavailable; enable pg_net before scheduling the cloud supervisor';
  end if;

  select jobid into prior_job_id
    from cron.job
   where jobname = 'dreamledger-commerce-supervisor-15m'
   limit 1;

  if prior_job_id is not null then
    perform cron.unschedule(prior_job_id);
  end if;

  perform cron.schedule(
    'dreamledger-commerce-supervisor-15m',
    '*/15 * * * *',
    $job$
      do $runner$
      declare
        service_role_jwt text;
        request_id bigint;
      begin
        select nullif(trim(decrypted_secret), '')
          into service_role_jwt
          from vault.decrypted_secrets
         where name = 'dreamledger_supervisor_service_role_key'
         order by updated_at desc
         limit 1;

        if service_role_jwt is null then
          raise exception 'Missing Vault secret dreamledger_supervisor_service_role_key; supervisor invocation held';
        end if;

        select net.http_post(
          url := 'https://wbwgroygjeyukkspnqiy.supabase.co/functions/v1/commerce-supervisor',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'apikey', service_role_jwt,
            'Authorization', 'Bearer ' || service_role_jwt
          ),
          body := jsonb_build_object(
            'trigger', 'supabase-pg-cron',
            'scheduled_at', now(),
            'contract', 'dreamledger-commerce-supervisor/v1'
          ),
          timeout_milliseconds := 10000
        ) into request_id;
      end $runner$;
    $job$
  );
end
$schedule$;
