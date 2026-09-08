# Truth Oracle Publication Admission Policy

## Purpose

The Truth Oracle establishes epistemic eligibility. It does not publish artifacts and it does not replace the Gauntlet.

Publication is a separate admission decision combining evidence, Truth Oracle verification, adversarial evaluation, policy, CI/runtime proof, and human authority where risk requires it.

## Mandatory publication chain

`ELOHIM -> TRUTH ORACLE -> GAUNTLET -> POLICY ADMISSION -> HUMAN AUTHORITY (conditional) -> COMPILER/CI -> PUBLISH -> TELEMETRY -> MARKET REALITY`

No stage may silently inherit authority from another stage.

## Truth Oracle gate

Allowed publication inputs:

- `VERIFIED`: eligible for ordinary publication consideration.
- `VERIFIED_WITH_CAVEATS`: eligible only where the publication policy permits caveated publication and the caveats are preserved with the artifact.

Blocked inputs:

- `UNVERIFIED`
- `CONTRADICTED`
- `STALE`
- `QUARANTINED`

A model response is never evidence by itself. Oracle eligibility requires recorded evidence with provenance and a reproducible candidate identity.

## Gauntlet gate

The candidate must independently survive the Gauntlet.

- `PASS`: eligible for publication admission.
- `FAIL`: blocked.
- `QUARANTINE`: blocked.
- `NEEDS_EVIDENCE`: blocked pending evidence and re-evaluation.

The Gauntlet is an adversarial gate, not a truth oracle. Passing it does not establish factual truth.

## Evidence and identity

Every admission is bound to:

- candidate key
- exact candidate SHA-256
- candidate type
- Truth Oracle verdict and, when available, Oracle run ID
- Gauntlet verdict and run ID
- evidence completeness
- CI verification state
- risk tier

If the candidate changes, its hash changes and prior admission receipts do not transfer.

## Policy admission

The publication gate requires all mandatory controls:

1. admissible Truth Oracle verdict;
2. Gauntlet `PASS`;
3. complete required evidence;
4. CI/build verification where applicable;
5. policy authorization for the candidate's risk tier;
6. explicit human approval for `HIGH` and `CRITICAL` risk candidates.

`LOW` and `MEDIUM` candidates may be automatically admitted when every mandatory machine gate passes and policy permits it.

`HIGH` and `CRITICAL` candidates must stop at `HUMAN_REQUIRED` until explicit human authority is recorded.

## Separation of powers

- Elohim proposes.
- Truth Oracle verifies evidence and epistemic status.
- Gauntlet attacks the candidate.
- Policy Admission combines independent results into an allow/deny decision.
- Human authority approves configured high-impact actions.
- Compiler and CI prove/package the exact candidate.
- Publisher releases only an admitted candidate.
- Telemetry and the economic ledger record what actually happened.
- Market reality can falsify the economic hypothesis after release.

## Hard invariant

> No publication without an admissible Truth Oracle verdict, Gauntlet `PASS`, complete required evidence, policy authorization, and required CI/human controls.

No component may bypass this invariant merely because another component is confident.

## Current implementation

Supabase function `public.control_plane_admit_publication(...)` is the authoritative admission decision surface. It creates an immutable candidate-bound admission receipt in `public.control_plane_publication_admissions`.

The database gate currently enforces:

- exact candidate identity;
- Truth Oracle verdict validity;
- Gauntlet verdict validity;
- risk-tier validation;
- evidence completeness;
- CI verification;
- human approval for high/critical risk;
- deterministic allow/deny/human-required outcomes.

The admission table is not directly exposed to `anon` or `authenticated` roles. Publication infrastructure must call the privileged admission path rather than writing admission receipts directly.

## Not yet claimed

This policy is now codified, but it does not by itself prove that every publisher in the repository currently calls the admission function. Publisher integration and end-to-end release proof remain required before claiming universal enforcement.