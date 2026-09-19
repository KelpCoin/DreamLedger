-- BECK supervised economic ecosystem / epistemic authority layer
-- Applied to DreamLedger production DB on 2026-09-19.
-- Canonical control remains Supabase; this file mirrors the applied change.

alter table public.jobs
  add column if not exists objective_key text,
  add column if not exists objective_text text,
  add column if not exists success_condition jsonb,
  add column if not exists failure_condition jsonb,
  add column if not exists authority_policy jsonb,
  add column if not exists budget_policy jsonb,
  add column if not exists current_state text default 'active',
  add column if not exists next_action jsonb,
  add column if not exists last_progress_at timestamptz,
  add column if not exists last_evidence_at timestamptz,
  add column if not exists cycles integer default 0,
  add column if not exists objective_version integer default 1;

create unique index if not exists jobs_objective_key_uidx
  on public.jobs(objective_key) where objective_key is not null;

alter table public.cube_evidence_vault
  add column if not exists epistemic_tier text default 'OBSERVATION',
  add column if not exists authority_role text,
  add column if not exists parent_evidence_ids uuid[];

alter table public.cube_evidence_vault
  drop constraint if exists cube_evidence_vault_epistemic_tier_check;

alter table public.cube_evidence_vault
  add constraint cube_evidence_vault_epistemic_tier_check
  check (epistemic_tier in ('MODEL_OUTPUT','OBSERVATION','VERIFIED','ECONOMIC_VERIFIED'));

create or replace function public.beck_enforce_epistemic_authority()
returns trigger language plpgsql security definer set search_path=''
as $$
declare a text := coalesce(current_setting('beck.epistemic_authority', true), '');
begin
  if new.source like 'beck.lm.%'
     and (new.verification_status='VERIFIED'
          or new.epistemic_tier in ('VERIFIED','ECONOMIC_VERIFIED')) then
    raise exception 'EPISTEMIC_FORBIDDEN: model output cannot become verified';
  end if;

  if tg_op='UPDATE'
     and old.verification_status <> 'VERIFIED'
     and new.verification_status='VERIFIED'
     and a not in ('deterministic_verifier','economic_verifier','receipt_verifier','gauntlet_verifier') then
    raise exception 'EPISTEMIC_FORBIDDEN: verified promotion requires verifier authority';
  end if;

  if tg_op='INSERT'
     and new.verification_status='VERIFIED'
     and a not in ('deterministic_verifier','economic_verifier','receipt_verifier','gauntlet_verifier') then
    raise exception 'EPISTEMIC_FORBIDDEN: verified insertion requires verifier authority';
  end if;

  if new.verification_status='VERIFIED' then
    new.epistemic_tier := case
      when new.source='beck.economic.verifier' then 'ECONOMIC_VERIFIED'
      else 'VERIFIED'
    end;
    new.authority_role := a;
  elsif new.source like 'beck.lm.%' then
    new.epistemic_tier := 'MODEL_OUTPUT';
    new.authority_role := 'model';
  end if;
  return new;
end $$;

drop trigger if exists cube_evidence_epistemic_guard on public.cube_evidence_vault;
create trigger cube_evidence_epistemic_guard
before insert or update on public.cube_evidence_vault
for each row execute function public.beck_enforce_epistemic_authority();

-- Supervisor policy is stored on the persistent objective.
-- Models may propose. Workers execute bounded actions. Verifiers promote evidence.
-- BusinessTruth remains the only economic authority.
