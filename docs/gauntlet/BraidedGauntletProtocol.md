# Braided Gauntlet Protocol - v1.0.0

**Status:** Active
**Applies To:** BEC PRIME / DreamLedger Cash Spine
**Owner:** BEC Steward
**Last Updated:** 2026-08-19

## 1. Purpose

The Braided Gauntlet is a fail-closed, multi-strand admission gate that converts synthesis signals (plans, code, workflows) into hardened signals (verified fossils: run logs, proofs, payment events).

It enforces:

- Evidence Before Claim - No PASS without a fossil.
- Real Money Only - NZ$0 until a live payment event matches the canonical SKU, amount, and currency contract.
- No Invented Proof - No simulated payments, fake deploys, or mock fossils.
- Idempotent Design - Duplicate payment events are deduplicated before ledger writes.

Any broken strand blocks the gate. The system remains PRE-MONEY or QUARANTINE until required strands are green.

## 2. Architecture - The Braided Strands

| Strand ID | Name | Required Fossil | Gatekeeper |
|---|---|---|---|
| S1 | Code Integrity | Commit SHA on main; compiler truth PASS | Compiler |
| S2 | CI / Build | Workflow run with required jobs PASS | GitHub Actions |
| S3 | Deployment | Vercel deploy proof; HTTP `/health` 200 | Vercel + probe |
| S4 | Commerce Catalog | `/api/catalog` returns canonical SKU and the approved price contract | HTTP probe |
| S5 | Checkout | Checkout session returns Stripe URL with canonical amount/currency/SKU | Stripe |
| S6 | Payment Settlement | Live `checkout.session.completed` matching canonical amount, currency, and SKU | Webhook + ledger |
| S7 | Fulfilment | Delivery proof / report artifact | Fulfilment engine |

**Rule:** A downstream strand cannot be promoted on the basis of an unproven upstream strand.

## 3. Terminal States

| State | Definition | Allowed Actions |
|---|---|---|
| NOT_PROVEN | Claim lacks a fossil. | Inspect; collect evidence; do not promote. |
| PRE-MONEY | Code/process may exist; no verified payment. | Repair, deploy, test checkout, seek a real payment. |
| QUARANTINE | A strand failed and cannot be safely auto-repaired. | Manual review required. |
| PASS | All required strands for the declared gate have green fossils. | Promote according to governance. |
| FAIL | A strand failed and retry/repair is possible. | Repair the specific atom; re-run. |

Transition rules:

- NOT_PROVEN -> collect fossil -> PASS or FAIL.
- FAIL -> repair -> re-run -> PASS or QUARANTINE.
- QUARANTINE -> manual review/override only where governance permits.
- PRE-MONEY -> real payment matching the canonical contract -> FIRST_PAYMENT_PROOF -> payment gate PASS.

## 4. Browning Loop - Internal Stress Procedure

When a claim enters the Gauntlet, atomize it into testable primitives, attack each primitive, invert assumptions, and rebuild only what survives.

### Step 1: Atomize

Example: "Deploy DreamLedger and sell the diagnostic."

Atoms include:

- `VERCEL_TOKEN` is non-empty and usable by the workflow.
- Vercel project can be resolved or created by the release operator.
- Build exits 0.
- Deployment exits 0.
- HTTP `/` returns 200.
- HTTP `/api/catalog` returns the canonical SKU.
- Checkout amount/currency/SKU match the approved price contract.
- Live settlement event matches the same contract.

If an atom cannot be named, the claim is not testable and cannot be promoted.

### Step 2: Attack

| Atom | Attack |
|---|---|
| `VERCEL_TOKEN` | Empty, missing, invalid, or wrong scope -> FAIL |
| Build | Dependency/build failure -> FAIL |
| Deploy | Project/token/deployment failure -> FAIL |
| HTTP catalog | 4xx/5xx or wrong SKU/price -> FAIL |
| Checkout | Wrong amount, currency, or SKU -> FAIL |
| Settlement | Missing signature/event mismatch/duplicate -> FAIL |

Observed DreamLedger failure on 2026-08-19:

`release-operator` run `32222244323` dispatched downstream Vercel Static Storefront run `32222255262`; checkout and release-SHA verification passed, then `Verify Vercel token` failed. Project creation, build, deployment, HTTP, and proof stages were not reached.

### Step 3: Invert

Examples:

| Assumption | Inversion |
|---|---|
| Dispatch is blocked | Verify whether the operator actually dispatched downstream. |
| HEAD is the historical SHA | Verify the live main tip before claiming state. |
| A checkout is a payment | Require a live settlement event. |
| A public price is canonical | Compare public, checkout, webhook, and gate contracts. |

### Step 4: Rebuild

Keep atoms with PASS fossils. Drop or quarantine atoms with FAIL or NOT_PROVEN status. Identify exactly one next atom where possible.

Current observed example:

```text
KEEP:   operator dispatch and the already-passed upstream steps
DROP:   production deployment and payment claims
NEXT:   make VERCEL_TOKEN non-empty/usable in GitHub Actions, then re-run
STATE:  PRE-MONEY
```

## 5. Cash Spine Integration

```text
CODE -> CI -> DEPLOY -> HTTP TRUTH -> CHECKOUT -> PAYMENT -> FULFILMENT -> LEDGER
```

Each arrow is a gate. If a required gate returns FAIL or NOT_PROVEN, downstream claims remain unproven.

Current observed Cash Spine fossil as of 2026-08-19:

```text
release-operator #5
run: 32222244323
  -> downstream Vercel Static Storefront: 32222255262
  -> checkout: PASS
  -> release SHA verification: PASS
  -> Verify Vercel token: FAIL
  -> project/deploy/HTTP/proof: NOT_REACHED
  -> first payment: NOT_PROVEN
  -> verified revenue: NZ$0
```

## 6. Governance and Human Promotion Boundary

The Gauntlet automates inspection, testing, evidence collection, ranking, and permitted deployment preparation.

It does not manufacture evidence or silently promote strategically significant artifacts where human approval is required.

Human review is required for:

- quarantine release decisions where governance requires it;
- approval-gated public actions;
- first-payment interpretation when contract ambiguity exists.

Revenue recognition must come from a live payment event and the event ledger. Manual insertion is not payment proof.

## 7. Proof Artifacts

Every Gauntlet execution should produce a proof manifest under:

```text
RUN-PROOFS/<run-id>/
  SPEC.json
  BUILD.json
  GAUNTLET.json
  DEPLOYMENT.json
  ECONOMIC.json
```

Required `GAUNTLET.json` fields include:

```json
{
  "run_id": "<run-id>",
  "gauntlet_version": "v1.0.0",
  "strands": {
    "S1": {"status": "PASS", "fossil": "<sha>"},
    "S2": {"status": "FAIL", "fossil": "<workflow-run>"},
    "S3": {"status": "NOT_REACHED", "fossil": null}
  },
  "overall_status": "FAIL",
  "blocking_strand": "S2",
  "next_action": "Repair the failing atom and re-run"
}
```

The example above is schema illustration only, not live evidence.

## 8. Versioning

Semantic versioning applies:

- MAJOR: breaking changes to strand definitions or terminal states.
- MINOR: new strands or states.
- PATCH: clarifications and non-semantic corrections.

Protocol changes should be reviewed and verified before promotion.

## 9. Enforcement

Deployment and settlement pipelines using this protocol must preserve the fail-closed evidence boundary. A workflow must not report PASS for a strand that was not actually executed and verified.

The DreamLedger ledger records revenue only when a live payment fossil satisfies the canonical settlement contract.

## 10. Current Machine Truth

As of 2026-08-19, based on the observed repository/workflow evidence available for this protocol update:

```json
{
  "protocol_version": "v1.0.0",
  "live_main_sha": "deee2468da5619c0344e560dd778a95a72c851fd",
  "release_operator_runs": "OBSERVED",
  "latest_operator_run_id": "32222244323",
  "latest_vercel_dispatch_run_id": "32222255262",
  "blocking_strand": "S3 (Deployment)",
  "blocking_atom": "Verify Vercel token = FAIL",
  "vercel_project": "NOT_REACHED",
  "deployment": "NOT_PROVEN",
  "first_payment": "NOT_PROVEN",
  "verified_revenue_nzd": 0
}
```

## 11. Price Contract Gate

The price contract must be resolved before the first real payment is recognized.

Known conflicting values observed before this protocol commit were:

```text
Public surface:       NZ$29 / 2900 cents
Webhook / MTG gate:   NZ$25 / 2500 cents
```

Therefore this protocol deliberately does **not** declare NZ$25 or NZ$29 canonical. The approved amount must be selected and then aligned across catalog, checkout, webhook, settlement gate, and any public offer surface before the payment strand can pass.

No payment claim may be promoted while that contract remains contradictory.

## 12. Next Action

The next infrastructure atom is:

1. Provide a non-empty, correctly scoped `VERCEL_TOKEN` to the GitHub Actions environment for `KelpCoin/DreamLedger`.
2. Re-run `release-operator.yml` on `main`.
3. Verify the token step itself is PASS.
4. Proceed only to the next actually reached strand.
5. Resolve the canonical price contract before first-payment verification.

Until those atoms are green, the cash spine remains PRE-MONEY.

## 13. Signature

**Steward:** BEC PRIME
**Date:** 2026-08-19
**Version:** v1.0.0

Truth lives in the proof. The Gauntlet enforces that boundary.
