# Migrate off Render (account cutoff)

**Status:** `dreamledger.org` returns 503 (`x-render-routing: suspend`). Public surface must leave Render.

## What Render was running

From `render.yaml`:

| Service | Role | Root |
|---------|------|------|
| `dreamledger-storefront` | Public web (Node + `server.js` preloads) | `public/` |
| `dreamledger-engine` | Private API (Stripe, Supabase, disk, webhooks) | `BEC-PRIME/` |

Full commerce needs both. **Getting the site visible again only needs the public files.**

## Recommended path: Cloudflare Pages (static public)

You already sit behind Cloudflare. Pages is the fastest way to restore HTML without Render.

### 1. Create the Pages project

1. [Cloudflare Dashboard](https://dash.cloudflare.com) → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
2. Select repo **KelpCoin/DreamLedger**
3. Settings:
   - **Production branch:** `main`
   - **Build command:** *(leave empty)*
   - **Build output directory:** `public`
   - **Root directory:** `/` (repo root; output is `public`)
4. Deploy

You get a `*.pages.dev` URL immediately.

### 2. Attach the domain

1. Pages project → **Custom domains** → add `dreamledger.org` and `www.dreamledger.org`
2. If the zone is already on Cloudflare, it will set the CNAME/records for you
3. Remove or override any DNS that still points at Render (`onrender.com` / Render IPs)

### 3. What works on static Pages (no engine)

- `/mtg/` — fixed master silo (real decks, claim-by-message)
- `/mtg-list` — free list form
- Deck detail pages under `/mtg/*.html`
- `/data/mtg-catalog.json`
- Homepage, Truth Oracle, billboard **page** (UI)
- Most static HTML/CSS/JS under `public/`

### 4. What does **not** work until engine is re-hosted

- Stripe checkout / webhooks
- Supabase-backed auth entitlement writes (server-side)
- `/healthz` and Node preloads in `public/server.js`
- Anything that needed `dreamledger-engine` env secrets

Those can stay “coming back” honestly. Do not fake live checkout on static hosting.

## Alternative: GitHub Pages

Repo already has `CNAME` → `dreamledger.org`.

1. Settings → Pages → Source: **Deploy from a branch**
2. Branch: `main` / folder: `/public` (or `/ (root)` if you use a workflow that copies `public`)
3. Point DNS A/CNAME per GitHub Pages docs

Cloudflare Pages is usually simpler when the zone is already on Cloudflare.

## Engine later (when you need money paths again)

Move `BEC-PRIME` (or a slim API) to one of:

- **Fly.io** or **Railway** — closest to Render Node + disk
- **Cloudflare Workers** + D1/KV — rewrite surface APIs
- Keep **Supabase** as data; only re-home the Node process and secrets

Do **not** commit secrets. Re-create env vars on the new host from your password manager / old Render dashboard export if still accessible.

## Checklist

- [ ] Cloudflare Pages project connected to `KelpCoin/DreamLedger`, output `public`
- [ ] Preview URL loads `/mtg/` with real decks
- [ ] Custom domain `dreamledger.org` on Pages
- [ ] DNS no longer depends on Render
- [ ] Confirm MTG catalogue and detail pages
- [ ] Homepage links to `/mtg/` work
- [ ] Later: re-home engine for Stripe/Supabase

## MTG silo (already fixed on `main`)

Commit `39ff638c` (and follow-ups):

- Clean `/mtg/index.html` — no zero counters, no Monte Carlo theatre
- Catalogue shows published Commander decks only
- Claim-by-message honest; detail URLs fixed for Quintorius / Dwynen / Jon Irenicus

Once Pages deploys `public/`, that surface is what visitors get.
