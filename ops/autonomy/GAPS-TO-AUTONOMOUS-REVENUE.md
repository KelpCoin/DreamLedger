# Gaps to a fully autonomous revenue engine

**Audience:** operator (husband) + any LLM continuing BEC work.  
**Truth baseline:** verified external revenue remains **NZ$0** until a real stranger pays + settlement + fulfilment proof.

This is not a pep talk. It is a gap map of what still blocks *fully autonomous* revenue (system runs loops with minimal human intervention).

---

## Definition of “fully autonomous revenue engine”

The system, without ongoing chat prompts, can:

1. Attract or receive **demand**  
2. Convert **intent → paid** live settlement  
3. **Fulfil** without human  
4. **Prove** settlement (idempotent)  
5. **Learn** and recompile offers/faces  
6. Repeat across many loops/silos  

Until all six run without you, autonomy is **partial**.

---

## Gap table (priority order)

| ID | Gap | Status | Who plugs it | Blocks full autonomy? |
|----|-----|--------|--------------|------------------------|
| G1 | **External demand** (strangers who pay) | OPEN | Operator + distribution; Truth Oracle; share packs; agents later | **YES — primary** |
| G2 | **Stripe live secret in GitHub `settlement-read` / Actions** | UNKNOWN until verified | Operator sets `STRIPE_SECRET_KEY` secret | YES for unattended settle |
| G3 | **Settlement Sync proven green on schedule** | PARTIAL (workflow exists) | Operator: Actions → run Commerce Settlement Sync | YES for unattended meter |
| G4 | **Billboard webhook live + signed on Render** | PARTIAL (code + registry claim ready) | Operator: `STRIPE_WEBHOOK_SECRET`, endpoint registered in Stripe | YES for zero-touch tile fulfilment |
| G5 | **Face vs compiler divergence** | OPEN | Prefer compile → deploy; stop permanent hand-edit as source of truth | Soft (scale) |
| G6 | **Demand / Intent feeds wired** | CONTRACT ONLY | Wire analytics/Oracle/checkout-open → notes | Soft until scale |
| G7 | **Multi-loop settlement** (NZ$29 + NZ$50 + future) | PARTIAL (one link in workflow env) | Extend reconcile job or parallel jobs per approved link | Soft |
| G8 | **Local multi-LLM autonomy** (LM Studio council) | UNPROVEN per truth contract | Windows box + workers + evidence | Soft for revenue; hard for local semantic autonomy |
| G9 | **Physical / human-fulfil SKUs** | CORRECTLY gated off | Leave off until logistics automation | N/A (must stay gated) |
| G10 | **Marketing / SEO / Oracle publish pipeline** | PARTIAL | Content + deploy Truth Oracle surface | Soft → demand |

---

## What is already in place (do not rebuild)

- Approved offers (tile NZ$50, diagnostic NZ$29) + Payment Links  
- `commerce-settlement-sync.yml` + `ops/commerce/reconcile-stripe-airtable.mjs`  
- Fulfillment registry: billboard founding + commander diagnostic `ready: true`, `operator_required: false`  
- Economic loop registry + settlement logic docs  
- Demand / Intent sentinel **contracts** + corroboration  
- Commerce Sentinel readiness workflow  
- BECK autonomy truth contract (honest: LOCAL_AUTONOMY_UNPROVEN)  
- Large compiler chain under `BEC-PRIME/compiler/`  

---

## Minimum path to *first* autonomous close (not “millions”)

1. **G1** — Someone outside the household pays a live link  
2. **G2–G3** — Settlement Sync sees `cs_` and writes proof artifact  
3. **G4** (tile) or diagnostic API path — fulfilment completes  
4. Fossil / proof hash sealed; meter > 0  

Only then can you talk about “engine closed a loop without chat intervention.” Distribution may still need a human this week.

---

## What software cannot invent

- Strangers with money  
- Live Stripe secrets (must live in env, never in git)  
- Proof that local LM workers completed jobs without observed runs  

Scripts below **audit and scaffold**; they do not manufacture sales.

---

## Operator checklist (copy)

```
[ ] GitHub secret STRIPE_SECRET_KEY (live) on settlement workflow
[ ] Actions: Commerce Settlement Sync → green, matching_paid_sessions: 0 OK
[ ] Stripe webhook → Render endpoint with signing secret
[ ] Test mode never mixed with live meter
[ ] Share pack posted on owned channels (demand)
[ ] On first pay: confirm fulfilment proof URL exists
[ ] Update economic-loops registry instances_completed only after proof
```

---

## Artifacts in this folder

| File | Purpose |
|------|---------|
| `audit_autonomy_gaps.py` | Air-gap audit of repo tree; writes gap report JSON |
| `Audit-AutonomyGaps.ps1` | Same idea for Windows PowerShell |
| `GAPS-TO-AUTONOMOUS-REVENUE.md` | This map |
