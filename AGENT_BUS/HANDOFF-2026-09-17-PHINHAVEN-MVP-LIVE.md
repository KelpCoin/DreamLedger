# HANDOFF — Phin Haven MVP + design contract (2026-09-17)

## Playable MVP on main

| URL (after Render) | Repo path |
|--------------------|-----------|
| https://dreamledger.org/phin-haven.html | `public/phin-haven.html` |
| Commit | `b68f5e6d…` |

**What works (server-authoritative via Supabase RPCs):**

- Create character / resume via `localStorage` token (`kelplantis:player_token`)
- Town move, Home, Dungeon engage / attack / flee
- World state + Floor/Depth 2 gate RPC
- DreamMeez bootstrap when RPC exists
- Labels: **Depth 1 · The Shallows**; Depth 2 locked until Depth 1 boss

**Optional fuller client** (decorate home, presence refresh, quest banners) is in operator attachments (`phin-haven-live.html` / artifacts). Promote that next if decorate RPCs are confirmed live.

## Design contract (from operator — implement in order)

1. **Depths = floors.** Depth 1 = **The Shallows**. Cannot enter Depth 2 without defeating Depth 1 boss (already gated server-side).
2. **Canonical city** is stable; outside city = single-shot / procedural (SWORD-like inspiration for storyline).
3. **Classes / races** with equip restrictions (e.g. half-crab / claw form cannot equip armor or weapons). Server must enforce, not client.
4. **Community design:** voting, guild control per depth influencing how that depth appears. Later phase — do not block MVP money loop.
5. **Cortex rule still holds:** Stripe = money truth; no pay → no build on paid features.

## Money priority (unchanged)

1. NZ$50 tile  
2. NZ$29 diagnostic  
3. Game keeps players; monetize cosmetics/access after first stranger pays storefront.

## Agent split

| Agent | Action |
|-------|--------|
| Grok (GitHub) | Shipped playable HTML on main |
| Claude (Supabase) | Confirm RPCs; class equip rules; append-only progression |
| Render | Redeploy so `/phin-haven.html` is live |

## HTML → product (plain language)

A single `.html` file in `public/` **is** the product surface once Render serves `main`. No separate “app store” step. Open the URL on phone/desktop; character persists in browser + server row.
