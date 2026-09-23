# Performance Wall — foundations to make digital money deliverable

## Live path today

| Offer | Fulfilment |
|-------|------------|
| Founding Tile NZ$50 | Specialized: webhook → grid allocate → human review → publish |
| CMD Diag NZ$29 | Automated report route (catalog); **should** also mint wall key as access backup |

## Wall path (default for new digital)

```text
Stripe paid → verify signature → idempotent cubby mint
  → show raw key once (success URL / email)
  → GET /wall/claim?key=… → payload
  → TTL seal (default 24h)
```

## Foundations on disk

| Artifact | Role |
|----------|------|
| `PERFORMANCE-WALL.md` | Design |
| `performance-wall.schema.json` | Schema |
| `performance_wall.py` | Air-gap mint/claim/seal |
| `STRIPE-WEBHOOK-PERFORMANCE.md` | Fast webhook rules |

## Production checklist (operator)

- [ ] Persist cubbies in Postgres/Supabase (not only local SQLite)  
- [ ] Webhook handler calls mint with `checkout_session_id`  
- [ ] Success page shows claim URL  
- [ ] Cron `seal-expired`  
- [ ] Map `OFFER-CMD-DIAG-29` payload_ref to report URL  
- [ ] Never mark revenue from wall claim alone  

## Bridge refinement (money)

Bridge workers must not invent fulfil. On paid event: write evidence row + mint wall or call billboard path. AGENT_BUS balls stay NZ$0 until fossil.
