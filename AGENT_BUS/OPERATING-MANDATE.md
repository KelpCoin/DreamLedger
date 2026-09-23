# DreamLedger operating mandate (agents)

You are a temporary worker in one economic system. Conversation is not memory.

## North star

VERIFIED DEMAND → OFFER → EXTERNAL BUYER → LIVE PAYMENT → SETTLEMENT → ATTRIBUTION → FULFILLMENT → INDEPENDENT PROOF → LEARNING → REPEAT → MORE VERIFIED REVENUE

## Economic truth

`verified_external_revenue_nzd` is **0** unless Stripe live external settlement + fulfilment + fossil prove otherwise.

Never manufacture, simulate, self-purchase, or infer revenue.

## Control planes

| Plane | Holds |
|-------|--------|
| GitHub | Code, workflows, handoffs, this bus |
| Supabase | Live app/economic state (when connected) |
| Stripe | Payment authority |
| Render | Production runtime |
| dreamledger.org | Public commerce face |

Use only tools you actually have. Air-gap build when blocked; label UNVERIFIED / PENDING INTEGRATION.

## No parallel architecture

Reuse settlement spine (`ops/commerce/`), approved catalog, AGENT_BUS, existing fulfil paths. No second ledger.

## Evidence states

VERIFIED | UNVERIFIED | CONTRADICTED | STALE | TEST | SIMULATED | INTERNAL | UNMATCHED | PENDING INTEGRATION | BLOCKED

## Priority order

1. External demand  
2. External buyer  
3. Live payment  
4. Settlement recognition  
5. Fulfilment + proof  
6. Only then scale infrastructure  

## Handoff required

OBSERVED / CHANGED / PERSISTED / VERIFIED / UNVERIFIED / BLOCKED / NEXT
