-- Public CUBE hypothesis commission catalog entry.
-- Hypotheses remain UNVERIFIED. This SKU is a generic fulfillment rail; the
-- hypothesis ID is carried in Stripe Checkout and PaymentIntent metadata.
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
