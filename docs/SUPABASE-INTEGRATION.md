# Supabase integration — DreamLedger / Phin Haven

**On disk for multi-LLM continuity.** Live DB is not writable from every agent sandbox.

---

## 1. Role of Supabase in the figure-eight

| Lobe | Supabase use |
|------|----------------|
| **Settle** | Orders, entitlements, economic bridge events, marketplace identity, settlement ledgers, Stripe-related evidence rows |
| **Play** | Progression, resource nodes (Kelplantis-era), client build metadata (`phinhaven_client_builds`), realtime where enabled |
| **Bus** | Job notes, control_bridge events, prospecting candidates (fail-closed / human review) |
| **Not** | Source of verified *revenue truth* alone — Stripe + Settlement Sync + fossil still dam the meter |

GitHub remains continuity for agents that cannot open the DB. Supabase remains **authoritative runtime state** when the project is up.

---

## 2. Repo layout

```text
supabase/
  migrations/     # SQL schema + RLS + RPCs over time
  functions/      # Edge Functions (Deno) — webhooks, scans, connect
BEC-PRIME/lib/billboardSupabaseMirror.js
BEC-PRIME/supabase/migrations/   # additional commerce SQL in some trees
stripe_supabase_reconcile.py
docs/play/SUPABASE-CLIENT-BUILDS-STATUS.md
AGENT_BUS/BRIDGE_AND_SUPABASE_STATUS_*.md
```

Project ref cited in older proofs: `wbwgroygjeyukkspnqiy` (confirm in dashboard if rotated).

---

## 3. Migration themes (by concern)

| Theme | Examples (filenames) |
|-------|----------------------|
| Economic bridge / AgentBridge | `economic_bridge_fail_closed_*`, `widen_agentbridge_*`, event graph hashes |
| Settlement / work ledger | `settlement_*`, `orchestrator_work_ledger`, order transition idempotency |
| Marketplace | identity binding, fulfillments storage bucket, Stripe Connect webhooks (functions) |
| Play / resources | Kelplantis resource nodes, inventory, realtime broadcast |
| Auth / hardening | public views, billboard RPC, prospecting RLS |
| Guest commerce | `stripe_guest_orders` (under BEC-PRIME/supabase in some paths) |

Pattern: **fail-closed**, **idempotent** transitions, **RLS** on sensitive tables, hashes for event integrity.

---

## 4. Edge Functions (integration surface)

Under `supabase/functions/` (non-exhaustive):

| Function area | Role |
|---------------|------|
| Stripe revenue / webhook-style | Ingest payment-related events into DB evidence |
| Marketplace Connect / seller onboarding | Stripe Connect seller path |
| Economic demand scan | Demand-side jobs |
| Shared marketplace-transfers | Transfer helpers |

Deploy via Supabase CLI / dashboard; secrets live in Supabase project settings, **not** git.

---

## 5. Client integration pattern

```text
Browser / Phin client
  → supabase-js (URL + anon key)
  → Auth (if used) or guest flows
  → REST/RPC under RLS
  → Realtime channels (play resources)
```

**Contract:** probe before login UI — see `docs/play/CLIENT-CONNECTION-FAILURE-CONTRACT.md`.  
**Builds table:** `phinhaven_client_builds` (rebrand; not silent 404).

Env (client-safe):

- `SUPABASE_URL` / `VITE_SUPABASE_URL`  
- `SUPABASE_ANON_KEY` (public)  

Service role: **server only** (Edge Functions, trusted workers, never ship to browser).

---

## 6. Agent / LLM access model

| Actor | Access |
|-------|--------|
| Operator SQL editor | Full |
| Edge Function + service role | Scoped server writes |
| GitHub Actions | Only if secrets + explicit workflows |
| Grok / Claude **sandbox** | **Usually none** — cannot replace operator DB |
| AGENT_BUS handoffs | Instructions for the next agent *with* DB access |

Never assume chat “updated Supabase.”

---

## 7. Integration with Stripe

```text
Stripe event → (Render webhook and/or Supabase Edge Function)
  → idempotent row / entitlement
  → Performance Wall or specialized fulfil
GitHub Settlement Sync → meter / fossil (BusinessTruth)
```

Supabase rows support product state; **verified_external_revenue_nzd** still requires the dam chain.

---

## 8. Gaps / next hardening

1. Confirm live project ref + that migrations are applied on prod.  
2. Client code pointing at old table names → `phinhaven_client_builds`.  
3. Loud connection errors in all entry clients.  
4. Commit recovered client builds into git so offline agents can work.  
5. Document which Edge Function is **canonical** for Stripe vs Render `server.js` path (avoid dual-writers without idempotency).  
6. Optional: Supabase as LangGraph/Postgres checkpointer later — not required for Ball C.

---

## 9. One sentence

**Supabase is the cloud state and edge-webhook plane for DreamLedger/Phin Haven; GitHub is agent continuity; Stripe+fossil remain money truth; sandboxed LLMs must not pretend they are connected.**
