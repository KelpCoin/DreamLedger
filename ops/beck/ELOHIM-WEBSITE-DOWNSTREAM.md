# Elohim → website downstream (zero manual)

**Goal:** You do not touch dreamledger.org by hand. Elohim/BEC compile owns the public surface; Canonical Release Spine owns convergence.

## Already in the repo (main)

| Layer | Workflow / tool |
|-------|-----------------|
| Elohim compile + gauntlet | `cloud-elohim-website-gauntlet.yml` (`npm run compile`, worker proof, gauntlet, brand, MTG surface) |
| Public faces | `bec-public-faces.yml` → `public/*.html` |
| Release + deploy wait | `canonical-release-spine.yml` on **push to main** |
| Host | Render auto-deploy; spine waits until `https://dreamledger.org/version` commit matches SHA |

Manual compile (`bec-auto-compile.yml`) is **recovery only**, not the normal path.

## Why you still feel involved

Live probe at contract write:

- Stripe checkout **200**
- Render origin **200**
- `dreamledger.org` buy/billboard **503**

So the **compiler→main path exists**, but the **public domain is degraded**. Zero-manual fails at domain/host mapping, not at “missing Elohim.”

## Target state (acceptance)

1. Merge/push to **main** only.  
2. Elohim compile runs in CI.  
3. Host auto-deploys Elohim exhaust.  
4. `dreamledger.org/version` matches the release SHA.  
5. `/`, `/billboard`, `/mtg`, authorized `/buy/*` return **200**.  
6. Recovery is API/adapter (Neon/CF/Render), not your dashboard.

Until (4)–(5) pass, the site is **not** zero-manual in production fact — only in design.

## What agents must not do

- Hand-edit live production HTML as the release path  
- Claim domain healthy from origin 200 alone  
- Claim revenue from checkout 200  
- Invent SKUs outside approved cells

## Parallel track

PR **#777** Cloudflare preview + recovery adapters exist so Render quota/domain failures do not force you back into the UI. Cutover stays draft until route parity + domain 200.

**Meter:** verified external revenue NZ$0.00.
