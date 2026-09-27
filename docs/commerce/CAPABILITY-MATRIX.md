# DreamLedger Capability Matrix

Status vocabulary:
- MISSING: no usable implementation
- SCAFFOLD: interface/schema exists but not connected
- PARTIAL: connected for some paths
- VERIFIED: tested against real state with evidence

| Capability | Current state | Exit evidence |
|---|---|---|
| Catalog | SCAFFOLD | Public catalog reads live DB rows |
| Variants | SCAFFOLD | Variant selection reaches checkout |
| Inventory | SCAFFOLD | Stock reservation/decrement is transactional |
| Cart | SCAFFOLD | Persistent cart survives refresh/session |
| Checkout | SCAFFOLD | Hosted checkout session created from DB product |
| Payment | SCAFFOLD | Verified provider event changes payment state |
| Order | SCAFFOLD | One idempotent order per checkout |
| Receipt | SCAFFOLD | Authorized receipt resolves from token |
| Fulfillment | SCAFFOLD | Fulfillment state follows verified payment |
| Refund | MISSING | Provider refund reconciles to order |
| Customer | SCAFFOLD | Customer identity links to orders |
| Merchant auth | MISSING | Authenticated member can access only assigned store |
| RLS | PARTIAL | Commerce policies pass positive/negative tests |
| Webhooks | SCAFFOLD | Signature verification + event idempotency |
| Durable actions | PARTIAL | Action can pause/resume without duplicate effect |
| Evidence | PARTIAL | Consequential event has source/hash/verdict |
| Operational graph | MISSING | Objects and relationships queryable |
| Connector fabric | MISSING | Common connector contract works for 2 providers |
| Agent control | MISSING | Agent version/capability/policy recorded per action |
| Analytics | MISSING | Metrics derive from canonical records |
| MCP commerce | PARTIAL | External machine can discover and invoke governed commerce operations |
| Developer API | MISSING | External client can perform supported read/action lifecycle |
| Marketplace | MISSING | Scoped third-party app installation works |
| External outcome | VERIFIED baseline = 0 | Real independent buyer + settled payment + fulfillment + evidence |

The baseline remains zero verified external revenue until the final row's conditions are met. No internal record can upgrade that state.
