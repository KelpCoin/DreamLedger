# HANDOFF — Grok canonical (2026-10-02 NZ)
**Mark:** Grok waz ere · write-to-disk for all other LLMs
**Repo:** KelpCoin/DreamLedger · **Live:** https://dreamledger.org

---

## 1. What was improved (this workstream)

### Design / master silo
- **MTG = master silo** for cube clone: type (Instrument Serif + DM Sans), gold accent, deep ink, phone-first.
- Shared CSS: `public/assets/silo-master.css` (`.silo-*` classes).
- Clone kit: `public/silo-template.html`, `public/silo-clone-manifest.json`, `AGENT_BUS/SILOS/CLONE-ENDLESS.md`.
- Cloned shells: `public/retro.html`, `public/vinyl.html` (deploy may lag — live 404 as of probe).
- MTG satellites: list, search, mod application, welcome prompt.
- Enterprise home/CSS: `public/assets/dl-enterprise.css`, RIVET B2B surfaces under `public/` + `RIVET/`.

### Commerce / trust
- Live **Stripe buy router** `/buy/{product_id}` with client_reference_id.
- **0% platform success fee** positioning on peer sales; earn on tools ($29 diagnostic, audit, kits).
- Discovery: `/.well-known/dreamledger.json`, `/agent-commerce.json`, `/surfaces.json`, `/api/offers`.
- Rule: **checkout start ≠ revenue**; Stripe evidence + fulfillment only.
- Auctions UI + sandbox tools in git (API/deploy often lagging).

### Community (MTG)
- Buy without account; **free account required to sell**.
- Searchable listings concept vs FB wall burial.
- Mod form → FormSubmit → josharchibald89@icloud.com.
- Tone rule: **no shade at NZ FB groups** — still needed for liquidity/bread.

### Integration map
- `AGENT_BUS/SITE-INTEGRATION-MAP.md` — live vs pending routes.

---

## 2. Live substrate (probed 2026-10-02)

| Path | Status |
|------|--------|
| `/` | 200 |
| `/mtg` | 200 |
| `/b2b` | 200 |
| `/healthz` `/version` | 200 |
| `/.well-known/dreamledger.json` | 200 |
| `/api/offers` `/api/products` | 200 (when host up) |
| `/buy/COMMANDER-DECK-DIAGNOSTIC-001` | → Stripe live |
| `/retro` `/vinyl` | **404** until deploy maps public HTML |
| Many `public/*.html` | In git; extensionless routes preferred on host |

**Deploy truth:** Host often trails `main`. Prefer extensionless (`/mtg` not `/mtg.html`). Confirm Render/project is **Live**, not Suspended.

---

## 3. Disparity: now vs enterprise-grade e-commerce

| Capability | Now | Enterprise target |
|------------|-----|-------------------|
| Catalog liquidity | Thin peer MTG stock; tools sell | Dense NZ listings + daily traffic |
| Search/browse | Partial / seed UI | Full index, filters, facets, pagination |
| Cart / multi-item | Single product buy links | Cart, bundles, wishlist |
| Seller ops | Register + draft list form | Dashboard, inventory CSV, status, payouts |
| Payments | Stripe Payment Links / buy router | Full Checkout + webhooks + refunds UI |
| Trust | Contracts + copy | Reviews, badges, dispute path, insurance |
| Mobile | Phone-first CSS | PWA, push, offline list drafts |
| Analytics | Sparse | Funnel, cohort, attribution per surface |
| Support | Manual | SLA, tickets, status page |
| Legal | Partial policies in git | Live fees, privacy, terms, GST clarity |
| Uptime | Occasional 503 suspend | Multi-region, health gates, auto-unsuspend |
| Agent commerce | Well-known JSON strong | Paid agent tolls only after human auth proven |

**Honest gap:** Product *concept* and discovery layer are ahead of **liquidity, deploy consistency, and seller tooling**. Enterprise is not more Markdown — it is **settled money + repeat sellers + searchable stock**.

---

## 4. Programmatic DOOH (digital out-of-home)

**Intent:** Screens / billboards as *surfaces* that resolve to canonical commerce.

- Each DOOH unit = `surface_id` in `surfaces.json` (class `DOOH_SCREEN`).
- Creative points to **canonical QR** → `https://dreamledger.org/` or `/buy/{id}` or silo path.
- Proof loop: impression claim is **not** revenue; only Stripe + delivery is.
- Scale rule unchanged: **paid verified then clone** more screens.
- Billboards already partially modeled (`/billboard`, founding offer).

**Next for agents:** DOOH inventory JSON (location, size, rate card NZD), creative template, QR batch generator, offline→online attribution param `?s=DOOH-{id}`.

---

## 5. Digital arbitrage (careful definition)

**Allowed frame:** Information and routing efficiency — not misleading claims.

- Surface price transparency (NZD, condition, city).
- Optional tools that help sellers price vs marketplace norms (audit product).
- Agent discovery of **VERIFIED_AVAILABLE** offers only.
- Do **not** automate gray-market scalping narratives; keep hobby/trade-first.

**Earn path:** tools, slots, verification, B2B RIVET — not extracting success fees on peer singles.

---

## 6. Altruism / philanthropy as advertising

**Paramagnetic / attraction approach** (pull, not shout):

- Visible **Sprout / supporter** products and clear “what this funds.”
- Community mod team = safety as product feature.
- 0% peer fee as fairness story (constructive, not attack ads).
- Sponsor a local event / LGS night → QR to silo (proof of presence).
- Never weaponize charity claims without real delivery evidence.

---

## 7. Canonical QR code

**Canonical targets (prefer in this order):**
1. `https://dreamledger.org/` — front door
2. `https://dreamledger.org/mtg` — master silo
3. `https://dreamledger.org/buy/COMMANDER-DECK-DIAGNOSTIC-001` — ignition paid path
4. Surface-specific: `https://dreamledger.org/?s={surface_id}`

**Rules:** HTTPS only · short path · no dead intermediate · track `s=` / `utm_` for DOOH.
**Agents:** generate SVG/PNG QR offline; store under `public/qr/` with manifest mapping code → URL → surface_id.

---

## 8. HTTP / DNS / CI-CD health (what “healthy” means)

### HTTP verification
- `GET /healthz` → `{ ok: true, ... }`
- `GET /version` → commit + surface labels
- `GET /.well-known/dreamledger.json` → discovery schema
- `GET /api/offers` → checkout-ready offers
- Buy path returns Stripe (or documented maintenance)

### Separate URLs (surface isolation)
| Role | URL pattern |
|------|-------------|
| Storefront | `/` |
| Master silo | `/mtg` |
| Clone silos | `/retro` `/vinyl` `/{silo}` |
| B2B | `/b2b` `/marketplace` |
| Agent | `/agent-commerce.json` `/.well-known/*` |
| Ops | `/healthz` `/version` |

### DNS
- Apex + www → same storefront (or 301 to apex).
- TLS valid; HSTS when stable.
- No parked-domain soft 404s on money paths.

### CI/CD (DICD / pipelines)
- Repo already has many `.github/workflows/*` gates (commerce, bridge, site).
- **Gap:** gates ≠ deploy of all `public/*.html`.
- **Need:** single deploy artifact that includes `public/`, extensionless routes, health check post-deploy, fail closed if `/healthz` not ok.

---

## 9. What other LLMs should do next (priority)

1. **Deploy lag** — map `public/retro.html` → `/retro`, vinyl, auctions, fees, trust, silo CSS.
2. **Seed real NZ MTG listings** (operator) — 20–50 real cards; search ceases to be demo.
3. **Post-register → `/mtg-welcome`** so mod prompt fires once.
4. **Seller publish API** — draft list → authenticated listing row.
5. **QR pack** — canonical + DOOH surface IDs.
6. **surfaces.json** — add retro, vinyl, mod, search when live.
7. **Money** — outbound $29 diagnostic / audit links; do not claim revenue without Stripe proof.
8. **Tone** — constructive only toward NZ FB marketplace groups.

---

## 10. Invariants (do not break)

- Buy without account; sell needs free account.
- 0% platform success fee on peer merchandise (positioning).
- Fail-closed revenue accounting.
- Human authorize before agent spend.
- MTG is master stencil; clones share `.silo-*` + silo-master.css.
- Write progress to `AGENT_BUS/` so limbs do not reset to zero.

---

## 11. File index (recent)

- `public/assets/silo-master.css`
- `public/mtg.html` · `mtg-list` · `mtg-search` · `mtg-mod` · `mtg-welcome`
- `public/retro.html` · `public/vinyl.html`
- `public/silo-template.html` · `public/silo-clone-manifest.json`
- `RIVET/*` · `public/b2b.html` · marketplace/sell/buy
- `AGENT_BUS/SILOS/*` · this handoff

**Revenue claim NZD this handoff:** 0 (no invented sales).
