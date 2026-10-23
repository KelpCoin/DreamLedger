# Agent Bridge Monetisation — NZ$19 Event Pack

**Status:** PRIMARY PATH  
**Date:** 2026-10-23  
**Goal:** First real external revenue from Agent Bridge with minimum complexity.

---

## 1. Most promising path (decision)

**Primary product:** Prepaid Event Pack  
**Price:** NZ$19 one-time  
**Quota:** 100 unique durable event receipts  
**Key lifetime:** 90 days from issue  
**Scope:** `bridge-events` only

### Why this path wins
- Closest to existing code (redeem + submit + receipt)
- Easy to explain in one sentence
- Low support surface
- Fits “pay once, get defined result”
- Can be used internally by owner / husband / friend at the same time
- Natural ladder later ($49 / 500, $149 / 2000)

All other paths in BRIDGE-TOLL-200.md stay on the shelf until this one produces verified external revenue.

---

## 2. Trust Toll path — assessment

Trust Tolls (paths 121–150) charge for verification, attestation, reputation scores, certified reports, auditor seats, etc.

**Verdict:** Not the first product.

| Factor | Assessment |
|--------|------------|
| Demand | Real only after people already depend on receipts |
| Infrastructure needed | Reputation scores, evidence packaging, auditor access, longer retention |
| Support burden | High (disputes, evidence quality, reputation repair) |
| Time to first dollar | Much longer than Event Pack |
| Fit with current code | Weak — most of it is not built |

**Recommendation:** Keep Trust Toll ideas documented. Revisit only after the $19 pack has real buyers and the receipt verify endpoint is live. Do not build Trust Toll features before the simple pack is selling.

---

## 3. Public product definition

**Name:** Agent Bridge Event Pack  
**One-sentence pitch:**  
> Pay NZ$19 once. Get a scoped key that lets your agents record 100 durable event receipts. Same event returns the same receipt. We never store your raw payload.

**What the buyer receives**
- One scoped key (`x-dreamledger-toll-key`)
- Cap of 100 unique receipts
- 90-day key expiry
- Remaining quota returned on every successful response
- Idempotent behaviour (same key + same payload → same receipt)

**What the buyer does not get**
- Unlimited usage
- Raw payload storage
- Guarantees about upstream work quality
- Access to other DreamLedger surfaces

---

## 4. Implementation steps (in order)

### Step 0 — Pre-conditions (must be true)
- [ ] Stripe live keys present and working for a simple product
- [ ] Supabase edge function `agent-toll-road` (or equivalent) can issue and validate keys
- [ ] Receipt ledger table exists and is append-only
- [ ] Idempotency unique constraint on `(key_id, idempotency_key, payload_hash)` exists

### Step 1 — Prove the 50c probe end-to-end
1. Create a Stripe Price / Product for NZ$0.50 (single use)
2. Checkout → payment succeeds
3. Redeem session ID → receive a key with quota = 1
4. POST one event with that key → receive receipt
5. Repeat same event → same receipt returned
6. Different payload with same idempotency key → 409
7. Record the successful chain as evidence (no revenue claim until independent settlement is verified)

**Gate:** Do not open the $19 pack until the probe chain is green.

### Step 2 — Create the $19 product in Stripe
- Product name: `Agent Bridge Event Pack`
- Price: NZ$19.00 one-time
- Metadata: `scope=bridge-events`, `quota=100`, `ttl_days=90`

### Step 3 — Redeem path
Endpoint: `POST /api/toll/v1/redeem/bridge-events`

Behaviour:
- Verify Stripe session is `paid` and matches the Event Pack price
- Issue key with:
  - `key_id`
  - `scope = bridge-events`
  - `quota_remaining = 100`
  - `expires_at = now + 90 days`
- Store only key hash, never log the full key
- Return the key once

### Step 4 — Submit path (already partially exists)
Endpoint: `POST /api/toll/v1/bridge-events`

Required headers:
- `x-dreamledger-toll-key`
- `Idempotency-Key`

Required behaviour:
- Validate key (hash, scope, not expired, quota > 0)
- Size-limit and schema-check payload
- Compute stable SHA-256 of normalised payload
- Upsert / lookup on `(key_id, idempotency_key, payload_hash)`
- Same triple → return original receipt (200)
- Same key + different payload → 409 Conflict
- New event → decrement quota, write receipt, return:

```json
{
  "receipt_id": "rcpt_...",
  "payload_hash": "sha256:...",
  "accepted_at": "ISO-8601",
  "remaining_quota": 99
}
```

### Step 5 — Public verify endpoint (small, high value)
`GET /api/toll/v1/receipt/{receipt_id}`

Returns only metadata (no payload). Makes the receipt useful to third parties.

### Step 6 — Public page
Update `/agent-bridge.html` (or equivalent):
- Clear “Buy Event Pack – NZ$19” CTA
- Honest status (held until probe is verified, then live)
- Short examples for redeem + submit
- Link to remaining-quota behaviour

### Step 7 — Internal keys
Issue free internal keys (or a shared internal key) for:
- Owner
- Husband
- Husband’s friend

They use the same handoff schema (`dreamledger.bridge.handoff.v1`) so the system is exercised daily before external buyers arrive.

### Step 8 — First external sale discipline
- Do not claim revenue until independent settlement evidence exists
- Keep success fee / platform cut at 0 for this pack
- Log every accept/reject (no secrets)
- After first real purchase: confirm fulfilment (key issued + first receipt works)

---

## 5. Internal handoff schema (reference)

```json
{
  "schema": "dreamledger.bridge.handoff.v1",
  "task_id": "string",
  "project": "string",
  "title": "string",
  "status": "UNCLAIMED | CLAIMED | IN_PROGRESS | BLOCKED | REVIEW | COMPLETE | CANCELLED",
  "owner": "string",
  "previous_owner": "string | null",
  "next_owner": "string | null",
  "objective": "string",
  "blocker": "string | null",
  "artifacts": [
    {
      "kind": "url | commit | file | receipt | note",
      "uri": "string",
      "sha256": "string | null",
      "note": "string | null"
    }
  ],
  "base_commit": "string | null",
  "result_commit": "string | null",
  "truth_label": "VERIFIED | UNVERIFIED | TEST | INTERNAL",
  "notes": "string | null",
  "updated_at": "ISO-8601"
}
```

Use this for all internal work between the three collaborators.

---

## 6. What not to do yet

- Do not open Route Leases
- Do not open Gauntlet packs for external buyers
- Do not open Trust Toll products
- Do not expose GPU jobs to the public
- Do not build dashboards or multi-tier subscriptions
- Do not claim the 200-path catalogue is live

---

## 7. Success criteria

- [ ] 50c probe: payment → redeem → receipt proven
- [ ] $19 pack purchasable
- [ ] At least one external key successfully issues and records a receipt
- [ ] Remaining quota visible
- [ ] Public verify endpoint works
- [ ] Internal handoffs using the schema are happening
- [ ] Verified external revenue > NZ$0 (only after independent settlement evidence)

---

## 8. One-sentence operating rule

Finish the probe, open the $19 pack, ignore everything else until real money has settled.
