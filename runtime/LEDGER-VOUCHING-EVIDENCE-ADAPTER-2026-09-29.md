# LEDGER-VOUCHING EVIDENCE ADAPTER
Date: 2026-09-29

## Purpose

Thin adapter that places [ledger-vouching](https://github.com/AndResearch/ledger-vouching) (Apache-2.0) as a spectator proxy in front of any LLM call that produces a commercial claim, fulfillment packet, or public evidence statement.

Guarantee is **provenance**, not correctness: every load-bearing value in a terminal answer must trace to observed tool evidence on the wire, or the claim is refused / flagged.

This does **not** replace Truth Oracle, substrate admission, or the A0→A3 authority boundary. It only enforces that claims presented as external results are grounded in observed evidence.

## Placement

```
Agent / worker  →  ledger-vouching proxy  →  upstream model
                         │
                         ▼
                   audit stream
                         │
                         ▼
              DreamLedger evidence path
              (Truth Oracle / activity / outcomes)
```

- Proxy is internal-network only. Never exposed publicly.
- Upstream key stays in the proxy; never stored or logged by DreamLedger.
- Client (our worker) points `base_url` at the proxy. One-line change.

## Configuration (minimal)

Required:

```
LEDVOUCH_FAIL_POSTURE=closed          # refuse unverified commercial claims
LEDVOUCH_MODE=block                   # or retry for repairable paths
LEDVOUCH_UPSTREAM_BASE=<model endpoint>
LEDVOUCH_UPSTREAM_KEY=<transit only>
LEDVOUCH_AUDIT_STREAM=webhook         # or file / stdout
LEDVOUCH_AUDIT_WEBHOOK_URL=<DreamLedger evidence ingest>
LEDVOUCH_DEPLOYMENT_ID=dreamledger-prod
LEDVOUCH_SYSTEM_ID=economic-swarm
```

Optional but recommended for commercial paths:

```
LEDVOUCH_AUDIT_OBSERVATION=on         # full evidence substrate per terminal turn
LEDVOUCH_ANSWER_HASH_HEADER=on        # X-Ledvouch-Answer-Hash on unaltered ships
```

Effect terminals (side-effect tools that mutate money, submission, or external state) should be declared so the proxy judges **before** execution:

```json
LEDVOUCH_EFFECT_TERMINALS=[
  {"tool": "create_stripe_checkout", "mode": "block", "data_fields": ["$.amount", "$.currency", "$.product_id"]},
  {"tool": "submit_statutory_form", "mode": "block", "data_fields": null},
  {"tool": "record_economic_outcome", "mode": "block", "data_fields": ["$.outcome_id", "$.amount", "$.buyer_id"]}
]
```

## Mapping to DreamLedger evidence

| ledger-vouching event | DreamLedger action |
|-----------------------|--------------------|
| `verdict: grounded` + `action: ship` | Allow claim into activity / evidence path. Record `sha_canon` as provenance join key. |
| `verdict: ungrounded` + `action: block` | Do **not** promote claim to external result or verified outcome. Record missing leaves. |
| `verdict: ungrounded` + `action: pushback/repair` | Keep worker alive; require grounded correction before any commercial surface. |
| `effect_verdict: ungrounded` | Block side-effect tool **before** execution. No payment, no submission, no outcome row. |
| `effect_receipt` | Join to fulfillment / settlement record by `tool_call_id` and `receipt_sha_canon`. |
| `posture` / verification unavailable | Fail closed (`closed` posture). Surface honest "verification unavailable". |

## Integration rules

1. Any output that asserts "fulfilled", "paid", "verified", "submitted", or "delivered" **must** pass through the proxy on the terminal turn that produces that assertion.
2. Database rows, internal activity, opportunity counts, and silo volume are **not** evidence lanes. The proxy will correctly reject claims that only ground on them.
3. Human-gate packets (reviewer-ready, exception lists, completeness checks) are allowed to ship if their numbers and facts ground on observed tool results or supplied buyer inputs.
4. Never claim statutory submission, Stripe settlement, or buyer confirmation unless the corresponding tool result was observed on the wire and the effect gate passed.
5. `sha_canon` of the terminal answer is the join key for later buyer confirmation, dispute, or portable reputation. Store it with the activity / outcome record.

## What this does not do

- Does not replace the substrate admission gate.
- Does not authorize external action (still A3 / human-gated).
- Does not invent buyers, payments, or outcomes.
- Does not judge correctness of tools or data — only lineage.

## First application targets

1. ACNC fulfillment packet generation (pivot 41–50).
2. RDTI preparation / reviewer packet (pivot 51–70).
3. Any public offer that states "what the buyer receives" or "what constitutes completion".
4. The FIRST-DOLLAR scoreboard ingest path — only grounded external outcomes increment it.

## Success criterion

A commercial claim reaches a public or settlement surface **only** when ledger-vouching has emitted a grounded verdict (or an explicit human override recorded outside the proxy). Ungrounded claims never become verified outcomes.
