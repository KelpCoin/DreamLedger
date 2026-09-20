# HANDOFF 2026-09-20 — Figure-eight / estuary / one hand washes the other

**For any LLM or human that lands here via GitHub or Supabase.**  
Read this before inventing a parallel system. Continuity bus = `AGENT_BUS/` + main branch.

## Metaphor → machine

| Metaphor | Machine |
|----------|---------|
| One hand washes the other | Local/agent work ↔ GitHub/Supabase durable state |
| Cogs turning cogs | Game slice → identity/cosmetics → offer → Stripe → entitlement → proof → next slice |
| Ping-pong balls | Small, durable artifacts in git that the *next* agent must hit |
| Figure-eight / estuary / dam | Loop with two lobes: **PLAY** and **SETTLE**; water (attention, proof, money) must pass the dam (evidence gate) |
| Money is one exhaust | Not the only product of the loop; required **soon** as a verified external settlement |

```
        PLAY lobe                         SETTLE lobe
   ┌──────────────────┐              ┌──────────────────┐
   │ The Shallows     │              │ Catalog / Stripe │
   │ Browser + Godot  │──identity───▶│ NZ$ offers       │
   │ Cosmetics/tiers  │◀─entitle────│ Webhook → proof  │
   └────────┬─────────┘              └────────┬─────────┘
            │                                   │
            └──────── AGENT_BUS / bridge ───────┘
                      (GitHub + Supabase)
```

Dam = evidence contract: no claim of revenue without external buyer + settled payment + attribution + entitlement + fulfillment + fossil.

## What is already spinning (do not re-litigate)

| Cog | Where | Status |
|-----|-------|--------|
| Floor 1 browser playable | `phinhaven/shallows/index.html` | Playable offline |
| Godot 4 scaffold | `phinhaven/godot/shallows/` | Open in Godot 4.2+ |
| Design data / loop | `PROOF/airgap/*` | Frozen numbers |
| Godot integration map | `PROOF/2026-09-20-GODOT-CLIENT-INTEGRATION-EXPLORE.md` | No prior Godot in org |
| LLM↔Supabase↔GitHub bridge | `KelpCoin/llm-supabase-github-bridge` | Partial; revenue NZ$0 verified |
| Stripe rail | DreamLedger commercial path | Code present; live stranger sale still the ignition |
| Prior money handoffs | `AGENT_BUS/HANDOFF-2026-09-17-MONEY-MVP.md` etc. | Priority offers listed |

**Verified external PHINHAVEN/DreamLedger revenue: still treat as NZ$0 until proof says otherwise.**

## Ping-pong balls (next agent must touch these)

Drop these in order. Each ball is small; completing one loads the next.

### Ball A — GitHub-only agent (no Supabase)
1. Confirm `phinhaven/shallows/index.html` still opens and clears (6 fronds or 5 kills).
2. If Pages/Render hosts the repo, ensure a public URL exists for that path (shareable demo).
3. Do **not** invent Floor 2. Expand only if Ball C (money) is moving.

### Ball B — Supabase-capable agent
1. Implement or verify **append-only** progression / claim ingest (never DELETE prior player rows).
2. Own-only appearance RPC if avatars exist; never other players' appearance.
3. Map `avatar_link.email` → Stripe entitlement email when a payment lands (cosmetics only).

### Ball C — Money exhaust (priority until first stranger pays)
From prior money MVP handoff — do not dilute:

1. **NZ$50 billboard tile** (highest contribution)  
2. **NZ$29 diagnostic**  
3. **NZ$79 Discord kit** (if digital delivery is automatic)  

One real Stripe `payment_intent.succeeded` + attribution + entitlement + proof **closes the first figure-eight**. Game play alone does not.

### Ball D — Bridge / dual-LLM
1. Read `KelpCoin/llm-supabase-github-bridge` README + `docs/figure-eight-status.json`.
2. Leave a new `AGENT_BUS/HANDOFF-YYYY-MM-DD-*.md` when you change state so the other LLM does not cold-start.
3. Local GPU worker stays offline-safe; do not mark work complete when the worker is down.

### Ball E — Godot human gate
1. Operator opens `phinhaven/godot/shallows` in Godot 4.x.  
2. Only after that runs: bind RPCs.  
3. Import any recovered historical Godot project **over** this path and update recon status.

## Exhaust ports (what can leave the system)

| Exhaust | Ready? | Notes |
|---------|--------|-------|
| **Money (Stripe)** | Gate open; ignition missing | Needs one external buyer + full evidence chain |
| Playable demo | Yes (browser) | Attention / proof of game, not revenue |
| Cosmetics/tiers design | Yes (schema sketches) | No power; Patreon/Discord signals later |
| TCG arbitrage pipeline design | Yes (airgap specs) | Alerts only; no auto-trade |
| Fossils / evidence | Bridge schemas | Package every real settlement |

Money is **one** exhaust. It must become active soon without pretending it already is.

## Rules for every agent on this bus

1. **Write to disk** (GitHub `AGENT_BUS/` or PROOF) — chat is not continuity.  
2. **One hand washes the other** — if you only have GitHub, leave clear work for Supabase agents; if only Supabase, leave clear work for GitHub agents.  
3. **No parallel mythologies** — PHINHAVEN Floor 1 = The Shallows; game ≠ business revenue ledger.  
4. **Evidence over claims** — NZ$0 until the chain closes.  
5. **Small balls, not oceans** — prefer one committed path over a redesign of everything.

## Operator stepping away

When the human steps away, the loop should still be legible:

- Next GitHub LLM: Ball A + C (storefront/live links) + this handoff  
- Next Supabase LLM: Ball B  
- Next human with Godot: Ball E  
- Money: Ball C until first verified settlement  

The estuary is the meeting of play-water and settle-water. The dam is the evidence gate. Keep the figure-eight turning; do not claim the ocean is full until proof says so.
