-- Fix tautological order-item checks in marketplace review INSERT policy.
-- Bind each order item to the review's actual order and listing.
-- Additive policy repair only; does not change existing rows or enable new features.

begin;

drop policy if exists marketplace_reviews_buyer_write on public.marketplace_reviews;

create policy marketplace_reviews_buyer_write
on public.marketplace_reviews
for insert
to authenticated
with check (
  reviewer_user_id = (select auth.uid())
  and exists (
    select 1
    from public.marketplace_orders o
    where o.id = marketplace_reviews.order_id
      and o.buyer_user_id = (select auth.uid())
      and o.order_state = 'complete'
  )
  and exists (
    select 1
    from public.marketplace_order_items oi
    where oi.order_id = marketplace_reviews.order_id
      and oi.listing_id = marketplace_reviews.listing_id
  )
);

commit;
