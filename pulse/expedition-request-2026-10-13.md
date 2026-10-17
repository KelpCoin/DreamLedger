# 777 Full-Cycle Trigger — 2026-10-13

Run the existing 777 Economic Pulse workflow from main when this trigger is merged. This is an execution request, not a result.

Required behavior:
- Prefer a real independently verifiable buyer/payment/fulfillment event if one is already present.
- Otherwise, select one source-backed, non-duplicate discovery component only if it passes the existing compounding gate.
- Capture exact run ID, job/step outcomes, source URLs, changed files, artifact hash, deployment proof, and no-op reason.
- Do not treat 777 Economic Engine #50 as the full pulse cycle; it only proves the economic compiler, FactoryFactory, adversarial checks, and truth boundary passed.
- Keep paid Agent Bridge execution held until the canonical manifest, live route, checkout, signed settlement, entitlement, quota, fulfillment, delivery receipt, and reconciliation agree.
- Do not change VERIFIED_EXTERNAL_REVENUE from NZ$0.00 without the complete independent evidence chain.
