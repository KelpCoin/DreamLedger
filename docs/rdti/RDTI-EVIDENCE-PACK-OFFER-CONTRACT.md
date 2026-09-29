# RDTI Technical Evidence Pack — Offer Contract v1

Status: QUALIFICATION_INTAKE_IMPLEMENTED / OFFER_NOT_YET_SALE_READY

## Buyer problem

A claimant or adviser has technical work recorded across source-control history and needs a structured index of contemporaneous technical evidence for a qualified RDTI reviewer to assess.

## Bounded deliverable

For one authorized software repository and one agreed work period, deliver:
- a JSON evidence index and readable HTML report;
- source commit IDs, authored timestamps, commit subjects, changed paths, and SHA-256 fingerprints of recorded Git patch bytes;
- explicit evidence classifications and source provenance;
- a reviewer checklist for project identity, core/supporting activity, technological uncertainty, systematic approach, test results, entity/location criteria, and expenditure records;
- missing-evidence and limitation statements;
- packet hash, compiler version, generation time, and repository head commit;
- a machine-readable receipt identifying the exact input scope and output hashes.

## Explicit exclusions

The pack does not determine RDTI eligibility, interpret a claimant's facts as legal/tax advice, calculate eligible expenditure, validate payroll or invoices, submit a claim, contact Inland Revenue, or certify that commit history proves the truth of a commit message. No such claim may appear in marketing or output.

## Intake qualification

Required before scope or quote:
- buyer role and desired outcome;
- high-level project description;
- repository ownership/permission confirmation;
- whether an RDTI adviser/provider is involved;
- relevant work period where known;
- explicit authority to submit the form and consent to store the request.

Do not collect credentials, tax identifiers, secrets, or confidential source code in the intake form. A repository URL is optional. Do not clone or inspect a repository until access scope and permission are confirmed.

## Commercial gate

The qualification endpoint records an INTERNAL, UNVERIFIED intake request only. It does not create a Stripe checkout, quote a price, contact a third party, or claim that the request is qualified demand.

Before accepting payment, an owner-approved offer record must define price, currency, turnaround, input limits, data retention/deletion, support boundary, acceptance criteria, refund/cancellation handling, and the production fulfillment route. A test must prove the paid chain from Stripe settlement through canonical order, entitlement, fulfillment, delivery, and evidence receipt.

## Fulfillment acceptance criteria

A fulfilled pack must:
1. identify the exact repository and commit range inspected;
2. identify the compiler version and input/output hashes;
3. distinguish raw source records from generated interpretation;
4. label unverified or missing reviewer fields as NOT_ESTABLISHED;
5. include limitations and reviewer handoff;
6. be downloadable by the authorized buyer;
7. be tied to a canonical settled order and fulfillment record;
8. have a receipt hash that can be independently recomputed.

## Promotion gates

- QUALIFICATION_RECEIVED: consented intake stored.
- SCOPE_CONFIRMED: repository permission, time period, and boundaries agreed.
- OFFER_APPROVED: price and terms approved by owner.
- PAYMENT_SETTLED: canonical Stripe order proves settlement.
- FULFILLED: accepted output delivered and fulfillment record updated.
- VERIFIED: output hash, delivery, settlement, and independent evidence join reconciled.

No state may skip ahead because an internal row or generated file exists. A qualification request is not a buyer, a checkout is not payment, and a generated packet is not a verified economic outcome.

## Current state

The compiler and CI artifact exist. The qualification front door and consent gate are implemented in the repository. The offer is deliberately not marked sale-ready: public deployment, database write path, owner-approved commercial terms, paid delivery, and independent fulfillment verification still require proof.
