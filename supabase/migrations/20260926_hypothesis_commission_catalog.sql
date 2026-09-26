-- Public CUBE hypothesis commerce surface.
-- One logical hypothesis is derived from every CUBE silo. This avoids storing
-- a million duplicate rows while making the million-hypothesis surface real.
-- Every row is explicitly UNVERIFIED and has synthetic provenance.
create or replace view public.cube_hypotheses
with (security_invoker = true)
as
select
  'HYP-' || s.id as hypothesis_id,
  s.id as silo_id,
  'Hypothesis: ' || s.label as title,
  'HYPOTHESIS ONLY: a buyer may value a paid, source-grounded evaluation or artifact related to the ' ||
    replace(s.label, '"', '') ||
    ' silo. Demand is UNVERIFIED until an independent external buyer pays and the resulting fulfillment is evidenced.' as statement,
  'UNVERIFIED'::text as status,
  'SYNTHETIC_FROM_CUBE_SILO'::text as source_basis,
  29::integer as price_nzd,
  'hypothesis_research_request'::text as fulfillment_type,
  '/hypotheses/' || s.id as public_route
from public.cube_silos s;

revoke all on public.cube_hypotheses from anon, authenticated;
grant select on public.cube_hypotheses to service_role;

insert into public.revenue_catalog
  (sku_id,name,lane,description,price_nzd,active,fulfillment_type,currency)
values
  ('HYPOTHESIS-COMMISSION-001',
   'CUBE Hypothesis Commission',
   'hypothesis',
   'Commission a source-grounded evaluation of a published DreamLedger CUBE hypothesis. The hypothesis is explicitly unverified; payment does not prove demand or the underlying claim.',
   29,
   true,
   'hypothesis_research_request',
   'NZD')
on conflict (sku_id) do update
set name=excluded.name,
    lane=excluded.lane,
    description=excluded.description,
    price_nzd=excluded.price_nzd,
    active=true,
    fulfillment_type=excluded.fulfillment_type,
    currency=excluded.currency,
    updated_at=now();
