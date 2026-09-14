-- Marketplace fulfillment artifacts are private by default.
-- Workers upload evidence/delivery artifacts here; buyer-facing routes issue time-limited signed URLs.
insert into storage.buckets (id, name, public)
values ('fulfillments', 'fulfillments', false)
on conflict (id) do nothing;
