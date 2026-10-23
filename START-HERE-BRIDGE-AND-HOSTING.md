# START HERE — Agent Bridge + hosting + money

**Date:** 2026-10-23  
**For:** You, your husband, your husband’s friend  
**Current live status:** `dreamledger.org` returns **503 Service Suspended** (Render). Nothing works until hosting is restored or moved.

---

## What is already finished in this repo

| Item | File |
|------|------|
| Simple Railway steps (non-expert) | `RAILWAY-HANDOVER-SIMPLE.md` |
| Railway config | `railway.json` |
| Longer Railway notes | `RAILWAY-DEPLOY.md` |
| Three-person internal use | `AGENT_BUS/BRIDGE/OPERATOR-THREE-PERSON-READY.md` |
| Public product: NZ$19 Event Pack | `AGENT_BUS/BRIDGE/MONETISATION-EVENT-PACK-19.md` |
| Leave Render notes | `MIGRATE-OFF-RENDER.md` |

You do **not** need to redesign the product. You need the site online, then internal keys, then the $19 pack.

---

## The only order that works

```
1. Hosting up (Railway recommended)
2. Secrets on Railway (Stripe + Supabase)
3. Domain points at Railway
4. Smoke test /healthz
5. Internal keys for the three of you
6. Each person posts one handoff
7. 50c probe proven
8. Open $19 Event Pack to the public
```

Skip any step and the next ones fail.

---

## YOUR job (or husband’s) — hosting only

Open **`RAILWAY-HANDOVER-SIMPLE.md`** and do Steps 1–3 only:

1. Railway.app → login with GitHub → New Project → deploy `KelpCoin/DreamLedger`
2. Variables → add `NODE_ENV`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`
3. Custom domain `dreamledger.org` + DNS CNAME away from Render

When `https://dreamledger.org/healthz` returns JSON (not 503), hosting is done.

**Database:** Keep using Supabase. Do not create a new Railway database unless you later want one on purpose.

---

## After hosting is up — Bridge for the three of you

1. Create **internal** keys (free, not the $19 product):
   - one for you
   - one for husband
   - one for husband’s friend  
   (or one shared internal key if simpler)

2. Each person posts one event with this shape:

```json
{
  "schema": "dreamledger.bridge.handoff.v1",
  "task_id": "INTERNAL-SMOKE-001",
  "project": "agent-bridge",
  "title": "First handoff smoke",
  "status": "COMPLETE",
  "owner": "you",
  "previous_owner": null,
  "next_owner": null,
  "objective": "Prove the Bridge accepts a handoff",
  "blocker": null,
  "artifacts": [],
  "base_commit": null,
  "result_commit": null,
  "truth_label": "INTERNAL",
  "notes": "First post after Railway move",
  "updated_at": "2026-10-23T14:00:00Z"
}
```

Example request (replace key and host):

```http
POST /api/toll/v1/bridge-events
Idempotency-Key: INTERNAL-SMOKE-001
x-dreamledger-toll-key: YOUR_INTERNAL_KEY
Content-Type: application/json

{ "payload": { ...paste schema object... } }
```

3. Confirm:
   - same request again → same `receipt_id`
   - different payload, same Idempotency-Key → 409

Full rules: `AGENT_BUS/BRIDGE/OPERATOR-THREE-PERSON-READY.md`

---

## Monetisation (public) — only after internal works

**Product:** Agent Bridge Event Pack — **NZ$19** for **100** receipts.

**Gate:** 50c probe must succeed (pay → redeem → one receipt → idempotency) before the $19 pack is offered.

**Do not** open Route Leases, Trust Tolls, Gauntlet packs, or GPU jobs yet.

Details: `AGENT_BUS/BRIDGE/MONETISATION-EVENT-PACK-19.md`

---

## What “done” looks like

### Internal (you three)
- [ ] Site not 503
- [ ] Internal keys exist
- [ ] Each of the three people has posted at least one handoff
- [ ] Idempotency works

### Public money
- [ ] 50c probe proven end-to-end
- [ ] $19 pack purchasable
- [ ] At least one external buyer can redeem and post a receipt
- [ ] Revenue only claimed after independent settlement evidence

---

## Message to send when hosting is live

Paste either:

- `Railway URL is: https://….up.railway.app`  
- or `dreamledger.org healthz is OK`

Then smoke tests on the Bridge can be run immediately.

---

## Honest limits

- Secrets and DNS require a human login (Railway, Stripe, Supabase, Cloudflare).
- Code, plans, schemas, and checklists are already in this repo.
- Until Step 1–3 are finished, the Agent Bridge cannot accept events for anyone.

**Next physical action:** open `RAILWAY-HANDOVER-SIMPLE.md` and complete Step 1.
