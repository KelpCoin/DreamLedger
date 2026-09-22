# Economic Loop Atom — BEC

## Definition

An **economic loop** is a closed, repeatable path:

```
DISCOVER → OFFER → AUTHORIZE → PAY → SETTLE → FULFIL → PROOF → LEARN → RECOMPILE
```

- **Live** only when settlement authority is external (Stripe live paid session) and proof is sealed.
- **Silo-isolated** by default; cross-silo edges are explicit, never implicit.
- **Faces** (e.g. dreamledger.org) are compiled views of loops — not the source of truth.
- **Scale target:** hundreds → thousands → hundreds of thousands of concurrent loop instances over time. Catalog candidates and silo registry are the expansion surface; approval + payment remain the gates.

## Truth rules

1. Gauntlet pass ≠ revenue  
2. Approval ≠ revenue  
3. Checkout click ≠ revenue  
4. Test mode ≠ revenue  
5. Self-pay ≠ verified external revenue  
6. Game / social activity ≠ business revenue  
7. Only live external paid settlement + fulfilment proof moves the meter  

## Isolation vs integration

| Mode | Rule |
|------|------|
| Separated silo | Loop never shares inventory, evidence, or settlement IDs across silos |
| Integrated | Explicit `edges[]` between loop_ids; shared identity optional; still separate proof records |

## Compiler (future default)

BEC compiles faces and loop stubs from catalog + silo registry. Manual composition of dreamledger.org is legacy; new faces and loops should be **compiler output**, not hand-edited HTML as the source of truth.
