# CUBE white-label — infinite silo scale

**Principle (cube.json):** `many_surfaces_one_commerce_spine`  
**Scale rule:** `paid_verified_then_clone`  
**Anti-bloat:** expand commercial surface without unnecessary internal complexity  
**Operator economics:** upscale ≈ local computer power (compile + gauntlet + workers), not per-silo SaaS tax

## Target shape vs TradeMe / Shopify

| Capability | TradeMe / Shopify | DreamLedger CUBE |
|---|---|---|
| List + sell | Marketplace / store | WEB_OFFER + catalogue |
| Checkout | Platform payment | Stripe canonical rail |
| Multi-category | Categories | **Silos** (mtg, core, kelplantis, …) |
| Reskin brand | Themes (paid apps) | **Evergreen CUBE reskin** — skin JSON + surface HTML, same spine |
| Agents | Limited | `/agent.json` + offers API |
| Proof | Weak | paid → delivered → proven |
| Marginal cost of Nth store | Plan / app fees | Compile + host public surface |

DreamLedger is not a pixel clone of either. It is a **sovereign commerce cube**: silos are skins; money and proof are shared.

## White-label boilerplate (clone unit)

Each new commercial skin is a **silo pack**:

```
silos/SILO_{NAME}/
  silo.json          # id, fee_rate, purpose, skin tokens
  offers/*.json      # gated until checkout verified
  surfaces/*.html    # optional public pages
  skin.css           # tokens only (colors, type, density)
```

**Forbidden in a silo pack:** new payment ledger, new proof schema, new “revenue” counter.

**Required:** map every sellable thing to `offer_id` on the DreamLedger spine.

## Evergreen CUBE reskin steps

1. Copy silo pack template  
2. Set `silo_id`, fee policy, skin tokens  
3. Add offers with `checkout_available: false` until Stripe link + fulfilment exist  
4. Register surfaces in `surfaces.json` / cube expansion  
5. `npm run compile` / surface compiler  
6. Gauntlet candidate (local) before public claim  
7. Ship only after first paid proof on that offer family — then clone winners  

## Infinite scale (honest)

- **Free to design/compile** on local machine (PowerShell orchestra, gauntlet, Elohim-class local loops)  
- **Not free:** Stripe fees, Render/host, domain, human fulfilment time  
- **Does not** mean infinite revenue without buyers  

## Figure-eight with local systems

See `CONTROL-PLANE/FIGURE-EIGHT-LOCAL-CLOUD-LOOP.md`.
