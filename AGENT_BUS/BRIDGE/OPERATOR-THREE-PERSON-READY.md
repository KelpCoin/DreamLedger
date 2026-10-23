# Agent Bridge — Ready for Three Collaborators

**Date:** 2026-10-23  
**People:** Owner (you), Husband, Husband's friend  
**Goal:** Bridge usable internally today once hosting is restored; monetisable externally via NZ$19 Event Pack.

---

## Current live status (2026-10-23)

| Check | Result |
|-------|--------|
| `dreamledger.org` | **503 — Service Suspended** (`x-render-routing: suspend`) |
| `POST /api/toll/v1/bridge-events` | 503 Suspended |
| Redeem endpoint | 503 / Cloudflare challenge |
| Verified external revenue | NZ$0 |

**Blocker:** The Render service that hosts the site is suspended.  
**Code and plan:** Present in this repo.  
**Paid product design:** NZ$19 / 100 receipts (see `MONETISATION-EVENT-PACK-19.md`).

Until hosting is restored (or moved to Vercel / Railway / similar), no one can post events or receive receipts.

---

## What “functional for the three of us” means

1. Hosting is up (not 503).
2. Each of the three people has a key (or shares one internal key) that can post events.
3. Every finished piece of work produces a handoff event using the schema below.
4. Same event + same key returns the same receipt (idempotent).
5. Different content with the same idempotency key is rejected (409).

Public monetisation (the $19 pack) is separate and only opens after the 50c probe is proven.

---

## Internal handoff schema (use this)

```json
{
  "schema": "dreamledger.bridge.handoff.v1",
  "task_id": "BRIDGE-001",
  "project": "agent-bridge",
  "title": "Short title",
  "status": "CLAIMED | IN_PROGRESS | BLOCKED | REVIEW | COMPLETE",
  "owner": "you | husband | friend",
  "previous_owner": null,
  "next_owner": "husband",
  "objective": "One sentence",
  "blocker": null,
  "artifacts": [
    {
      "kind": "note",
      "uri": "path or url",
      "sha256": null,
      "note": null
    }
  ],
  "base_commit": null,
  "result_commit": null,
  "truth_label": "INTERNAL",
  "notes": null,
  "updated_at": "2026-10-23T13:50:00Z"
}
```

**How to post (once hosting is live):**

```http
POST /api/toll/v1/bridge-events
Idempotency-Key: BRIDGE-001-complete-20261023
x-dreamledger-toll-key: <internal-key>
Content-Type: application/json

{ "payload": { ...schema object above... } }
```

---

## Rules for the three of you

1. Claim a task before writing (status → CLAIMED / IN_PROGRESS).
2. Only one active writer per task_id at a time.
3. When finished, set status COMPLETE or REVIEW and name next_owner.
4. Put real blockers in the `blocker` field — never leave them vague.
5. Do not share external paid keys. Internal keys are free and unlimited for the three of you until you decide otherwise.
6. Never paste live keys, Stripe secrets, or webhooks into chat, issues, or prompts.

---

## Monetisation (public)

- Product: **Agent Bridge Event Pack** — NZ$19 for 100 receipts.
- Path: documented in `AGENT_BUS/BRIDGE/MONETISATION-EVENT-PACK-19.md`.
- Gate: 50c probe must succeed end-to-end before the $19 pack is opened.
- Trust Toll and the rest of the 200 paths stay offline until the simple pack has real settled revenue.

---

## Restore checklist (do this first)

### Option A — Unsuspend Render (fastest if billing is fine)
1. Log in to https://dashboard.render.com
2. Find the suspended service(s) for dreamledger.org / silo-gateway
3. Resume or fix billing
4. Wait for deploy to finish
5. Confirm https://dreamledger.org no longer says “Service Suspended”

### Option B — Move to Vercel or Railway (recommended if Render keeps failing)
1. Go to vercel.com or railway.app
2. Sign in with the GitHub account that owns KelpCoin/DreamLedger
3. Import the repo → Deploy
4. Point dreamledger.org DNS at the new host
5. Confirm the site loads

### After hosting is back
1. Issue internal keys for the three collaborators (or one shared internal key).
2. Each person posts one test handoff event.
3. Confirm idempotency (same payload → same receipt).
4. Only then run the 50c probe for the public pack.

---

## Success criteria for “it works for us”

- [ ] Site responds (not 503)
- [ ] At least one internal key can POST an event and get a receipt_id
- [ ] All three people have posted at least one handoff event
- [ ] Idempotency behaves correctly
- [ ] No secrets shared in the open

---

## One sentence

Restore hosting → issue three internal keys → start posting handoffs with the schema above → open the $19 pack only after the 50c probe is green.
