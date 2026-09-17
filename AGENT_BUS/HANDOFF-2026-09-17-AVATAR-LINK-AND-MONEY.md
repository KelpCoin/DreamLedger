# HANDOFF 2026-09-17 evening — Avatar link + money (shared outcome)

Shared outcome: **real settled Stripe revenue for the operator as fast as possible.** No fake claims.

## This agent (Grok) has GitHub — wrote to disk on cloud

| Done | Path / commit |
|------|----------------|
| Link Avatar UI on Floor 1 | `public/phinhaven/floor1.html` → `ca0e3292…` |
| HUD: **Link avatar** button + modal (name + optional email) |
| Linked pill on HUD + nameplate on sprite |
| localStorage `phinhaven_avatar_link_v1` (append-only; does not wipe run rows) |
| Claim payload includes `avatar_link` |
| postMessage `PHINHAVEN_AVATAR_LINK` + existing claim event |
| Enterprise storefront | live `enterprise-v1` on dreamledger.org |
| Unit economics + competitive pricing | `ops/economics/UNIT_ECONOMICS_AND_COMPETITIVE_PRICING_2026-09-17.md` |
| Distribution copy | `ops/distribution/DISTRIBUTION_STARTER_PACK_2026-09-17.md` |

## Claude / Supabase-only agents — do this next

1. **Append-only** claim ingest: when client posts claim with `avatar_link`, write progression row; **do not DELETE** prior player rows.
2. Match `avatar_link.email` to Stripe entitlement emails for DreamMeez cosmetics when possible.
3. You cannot fix Render/GitHub CI from Supabase alone — leave that to GitHub agents (this bus).

## Money path (do not dilute)

Priority order until first stranger pays:

1. **NZ$50 billboard tile** — highest contribution ≈ NZ$38–40  
2. **NZ$29 diagnostic** — volume / intent; template labour ≤20 min  
3. **NZ$79 Discord kit** — high margin if digital delivery is automatic  

Distribution: use starter pack copy. One real Stripe settlement closes the loop.

## Honest boundary

| Agent | GitHub | Supabase | Stripe live |
|-------|--------|----------|-------------|
| Grok (this session) | yes | no connector | links only |
| Claude (user message) | no (per user) | yes | no |

Continuity bus = **this folder + main branch commits.** Read latest `AGENT_BUS/HANDOFF-*.md` before inventing parallel systems.

## Promote check

After Render picks up `ca0e3292…`:

- Open `https://dreamledger.org/phinhaven/floor1.html`
- See **Link avatar** + linked pill
- Save name → pill turns green → nameplate on player
