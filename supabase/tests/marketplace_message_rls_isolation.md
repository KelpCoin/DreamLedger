# Marketplace RLS isolation verification

Target migration: `20261001120000_fix_marketplace_message_conversation_rls.sql`.

Run in an isolated Supabase branch with disposable auth users. Do not run destructive fixture setup against production.

## Fixture
Create two unrelated users (buyer A and buyer B), two seller identities, two listings, two orders, two conversations, and one message in each conversation. Conversation A must reference order/listing A and conversation B order/listing B. Set the JWT subject to each test user's UUID before each assertion.

## Required assertions
1. Buyer A can select message A.
2. Buyer A cannot select message B, even when buyer A is an order party on a different order.
3. Buyer B can select message B.
4. Buyer A cannot insert a message into conversation B while claiming buyer A as sender.
5. Buyer A can insert into conversation A only when sender_user_id is buyer A.
6. Buyer A cannot impersonate seller B by setting sender_user_id to seller B.
7. A user unrelated to either conversation sees no messages and cannot insert into either conversation.
8. The test fails against the pre-fix tautology policy and passes against the migration.
9. Inspect pg_policies after migration and assert both policies compare `c.conversation_id` to `marketplace_messages.conversation_id`.
10. Re-run the tests after any changes to `marketplace_is_order_party`, order RLS, or conversation schema.

## Important boundary
The migration is not production-remediated until these assertions pass against the actual Supabase schema and the deployed policy definition is re-read. A successful static check alone is not evidence of row-level isolation.
