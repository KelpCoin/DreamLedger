# HANDOFF 2026-09-20 — Money + bridge (operator wants exhaust soon)

**Priority:** Ball C (money exhaust) + Ball D (bridge continuity).  
**Not claimed:** verified external revenue still **NZ$0** until fossil + Truth Oracle PASS.

## What this agent (Grok) wrote to disk

| Item | Path |
|------|------|
| First-sale execution checklist | `ops/economic/FIRST-SALE-EXECUTION-CHECKLIST-2026-09-20.md` |
| This handoff | `AGENT_BUS/HANDOFF-2026-09-20-MONEY-AND-BRIDGE.md` |
| Updated balls | `AGENT_BUS/PING_PONG_BALLS.json` |
| Bridge offer seeds + protocol | see `KelpCoin/llm-supabase-github-bridge` commits same day |

## Money path (do not dilute)

Canonical live links (from distribution pack):

| SKU | NZ$ | Stripe / entry |
|-----|-----|----------------|
| Billboard tile | 50 | https://buy.stripe.com/9B66oH2rj3dz82jcR6dwc2x |
| Commander diagnostic | 29 | https://buy.stripe.com/00w7sLaXP01n96nbN2dwc2l |
| Store front | — | https://dreamledger.org/?src=dist |
| MTG surface | — | https://dreamledger.org/mtg?src=dist |

Contribution ranking (from unit economics): Discord kit (if zero-touch) > tile (~NZ$38–40) > diagnostic (template to ≤20 min labour).

**This week push order:** tile + diagnostic only until first stranger pays. Then kit. Do not ad-spend physical NZ$400 without COGS.

## Settlement spine already in repo

- `ops/commerce/README.md` — Stripe live authority, Airtable index, Actions reconciliation  
- Workflow: `.github/workflows/commerce-settlement-sync.yml` (per commerce README)  
- Pre-sale proof expectation: `matching_paid_sessions: 0`, `verified_revenue_nzd: 0`  

GitHub agent with secrets: run **Commerce Settlement Sync** workflow_dispatch and archive artifact. That strengthens the **meter**, not the sale.

## Bridge (llm-supabase-github-bridge)

- Evidence contract + `economic_events` / `fossils` / `oracle_verdicts` migrations exist  
- `docs/figure-eight-status.json` points at DreamLedger AGENT_BUS  
- Strengthening: offer seed rows for NZ$29 / NZ$50 / NZ$79, agent ping protocol, fossil packager sketch  

Supabase agents: apply bridge migrations if not applied; never mark test-mode as verified external.

## Play lobe (do not confuse with money)

- Browser: `phinhaven/shallows/index.html`  
- Godot scaffold: `phinhaven/godot/shallows/`  
Game activity ≠ business revenue. Coupling later via avatar email ↔ Stripe entitlement only.

## Next agent checklist (pick one, finish, handoff)

1. **Human / distribution:** Post tile + diagnostic links on **owned** channels only (starter pack copy).  
2. **GitHub + secrets:** Run settlement sync; confirm artifact still honest at NZ$0 or records a real cs_.  
3. **Supabase:** Apply evidence migration; ensure webhook path can insert `economic_events` with signature verify.  
4. **Any:** After first live paid session — package fossil, set offer VALIDATED, update `verified_external_revenue_nzd`.

## Blockers this session cannot clear

- No Stripe secret in this agent context → cannot create live sessions or read live PI list.  
- No Supabase connector here → cannot apply migrations to production DB.  
- Cannot manufacture external demand.

## Continuity rule

Write the next `AGENT_BUS/HANDOFF-*.md` when state changes. Read `PING_PONG_BALLS.json` before inventing a parallel money system.
