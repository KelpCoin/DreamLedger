-- Fix marketplace message policies to bind each message to its own conversation.
-- The previous predicate c.conversation_id = c.conversation_id was tautological
-- and could expose messages across conversations to any qualifying buyer/order party.
-- This migration changes only policy predicates; it does not enable messaging or insert data.

begin;

drop policy if exists marketplace_messages_party_read on public.marketplace_messages;
create policy marketplace_messages_party_read
on public.marketplace_messages
for select
to authenticated
using (
  exists (
    select 1
    from public.marketplace_conversations c
    where c.conversation_id = marketplace_messages.conversation_id
      and (
        c.buyer_user_id = (select auth.uid())
        or exists (
          select 1
          from public.marketplace_orders o
          where o.id = c.order_id
            and public.marketplace_is_order_party(o.id)
        )
      )
  )
);

drop policy if exists marketplace_messages_party_insert on public.marketplace_messages;
create policy marketplace_messages_party_insert
on public.marketplace_messages
for insert
to authenticated
with check (
  sender_user_id = (select auth.uid())
  and exists (
    select 1
    from public.marketplace_conversations c
    where c.conversation_id = marketplace_messages.conversation_id
      and (
        c.buyer_user_id = (select auth.uid())
        or exists (
          select 1
          from public.marketplace_orders o
          where o.id = c.order_id
            and public.marketplace_is_order_party(o.id)
        )
      )
  )
);

commit;
