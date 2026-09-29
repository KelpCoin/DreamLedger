-- Existing agent_toll_products registry entry for the quote comparison toll road.
-- This migration mirrors the production DML already applied to project wbwgroygjeyukkspnqiy.
insert into public.agent_toll_products
  (product_id, name, price_usd, endpoint, active, description)
values
  (
    'truth.quote_compare',
    'Quote comparability verdict',
    0.50,
    'POST /v1/compare_quotes',
    true,
    'Compares 2-5 supplier quotes using deterministic extraction, normalization and evidence checks.'
  )
on conflict (product_id) do update
set
  name = excluded.name,
  price_usd = excluded.price_usd,
  endpoint = excluded.endpoint,
  active = excluded.active,
  description = excluded.description;
