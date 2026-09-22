# Intent-to-Pay Sentinel

## Purpose

Observe signals that a party is **closer to paying** than mere curiosity.  
Still **not** revenue until Stripe live settlement + proof.

## Why it exists

Demand alone is noisy. Intent-to-pay narrows the set of loops worth prioritising for fulfilment readiness and distribution.

## Signal classes (v1)

| Code | Meaning | Example |
|------|---------|---------|
| `I-CHECKOUT_OPEN` | Stripe Checkout / Payment Link opened | session started |
| `I-CHECKOUT_ABANDON` | Checkout started, not completed | drop-off |
| `I-PREFILL` | Email / URL prefilled on billboard flow | form progress |
| `I-RETURN_PAY` | Return to same payment link | strong intent |
| `I-AGENT_HANDOFF` | Agent presented checkout_url to human | agentic path |
| `I-QUOTE_ACCEPT` | Explicit “I’ll buy” in supported channel | logged, not claimed paid |

## Output contract

**IntentNote** — `schema/intent-note.json`.  
May reference `demand_note_ids[]` when corroborating.

## Hard rule

`I-*` never increments `verified_external_revenue_nzd`.  
Only Commerce Settlement Sync + fossil path does that.

## Corroboration with Demand

| Demand | Intent | Action |
|--------|--------|--------|
| High D, no I | Cold interest | Improve CTA / Truth Oracle content |
| Low D, high I | Hot small set | Prioritise fulfilment readiness |
| High D + high I | Hot loop | Operator/agent distribute harder |
| Neither | Idle silo | Do not invent activity |
