create table if not exists golden_eval_cases (
  case_id text primary key,
  domain text not null,
  target text not null,
  contract jsonb not null,
  expected jsonb not null,
  source_refs text[] not null default '{}',
  status text not null check (status in ('ACTIVE','QUARANTINED','RETIRED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists golden_eval_cases_domain_status_idx
  on golden_eval_cases (domain, status);

alter table golden_eval_cases enable row level security;

drop policy if exists "service_role_full_access" on golden_eval_cases;
create policy "service_role_full_access" on golden_eval_cases
  for all to service_role using (true) with check (true);

insert into golden_eval_cases(case_id, domain, target, contract, expected, status)
values
(
  'VINYL-LANDED-COST-001',
  'price_discovery',
  'AIM - Cold Water Music',
  '{"must_contain_all":["exact_release","condition","ships_from","listing_price","shipping","currency","fx","landed_nzd","observed_at"]}',
  '{"decision":"BUY_OR_PASS","rule":"landed_nzd_must_be_computable_and_below_case_ceiling"}',
  'ACTIVE'
)
on conflict (case_id) do update
set contract = excluded.contract,
    expected = excluded.expected,
    status = excluded.status,
    updated_at = now();
