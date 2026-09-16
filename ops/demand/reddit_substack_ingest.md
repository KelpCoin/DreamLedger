# Reddit + Substack demand ingestion

## Goal

Feed **demand candidates** into the radar / prospecting tables with an **intent score**, without spam and without claiming revenue.

## Reddit (read / classify — do not spam)

### Queries (Commander / NZ / tools)

- `commander diagnostic` OR `deck help` OR `rate my deck` subreddit:EDH OR subreddit:BudgetBrews OR subreddit:mtg
- `buy commander deck` NZ OR Australia
- `discord webhook stripe` OR `stripe to discord`
- `digital billboard` OR `pixel ad buy` (low volume — tag carefully)

### Classification

| Language in post | Tag | Action |
|------------------|-----|--------|
| “pay / buy / how much / invoice” | `intent_language` | Queue human reply with NZ$29 diagnostic link only if subreddit allows |
| “help with list / rate my deck” | `demand_help` | Offer diagnostic once; no hard sell |
| “built a tool / competing product” | `supply_competitor` | Note competitor; do not attack |
| Self-promo only | `noise` | Ignore |

### Allowed posting (agent + human)

- Prefer **value-first** comments on threads that already asked for help.
- Never mass-post QR or affiliate spam.
- Respect each subreddit’s self-promo rules; default is **comment, not thread**.
- Canonical link: `https://dreamledger.org/mtg?src=reddit` or Stripe diagnostic URL.

## Substack (ingest topics, don’t scrape paywalls)

### Sources

- Public MTG / indie SaaS / maker newsletters (titles + free previews only).
- Search: “commander”, “EDH”, “stripe webhook”, “supabase production”.

### Output row shape (for `ops/demand/` JSON or Supabase prospecting)

```json
{
  "source": "reddit|substack",
  "url": "https://...",
  "title": "...",
  "captured_at": "ISO-8601",
  "demand_score": 0-100,
  "intent_score": 0-100,
  "matched_sku": "commander-diagnostic|billboard-tile|discord-kit|none",
  "notes": "short"
}
```

`intent_score` ≥ 70 requires explicit pay language or checkout signal — not upvotes alone.

## Automation hook

Existing workflows:

- `.github/workflows/demand-radar.yml`
- `ops/demand/demand_radar.py`
- `BEC-PRIME/runtime/DemandRadar.js`

Extend collectors to emit the row shape above; store under `ops/demand/inbox/` or Supabase `prospecting_candidates` with `approval_status=pending_human_review` only.
