# DreamLedger Zero-Operator Handover Contract

Date: 2026-08-21

## Purpose

Define the unattended operating boundary for BrownEye Cortex and DreamMeez. Deterministic evidence remains authoritative. LM Studio may propose work but may not declare success.

## Canonical loop

SOURCE -> CI -> IMMUTABLE SHA -> RENDER + VERCEL -> LIVE PROBE -> PROOF -> LEDGER -> ITERATION

## Release gates

1. Main contains the intended release commit.
2. CI completes for the exact release SHA.
3. The compiled artifact is identified by release SHA and, where available, artifact hash.
4. Render and Vercel are inspected as deployment targets of the same release.
5. Divergence is a hard stop. Do not repair divergence by blind redeployment.
6. Production HTTP probes must pass for the critical application surfaces.
7. Commerce is not proven by the existence of a checkout URL. A verified payment-provider event is required for revenue proof.
8. A proof artifact is required for every state transition.

## Autonomous actions allowed

- Health checks.
- Bounded retries of transient failures.
- Local compilation and deterministic tests.
- Creation of branches and commits.
- Pushes to non-main branches.
- CI observation.
- Deployment observation.
- Proof generation.
- Queueing repair work.
- LM Studio analysis of observed evidence.

## Human approval gates

- Merge to main when branch protection requires human approval.
- Public posting or external outreach.
- New paid services or infrastructure.
- Spending beyond the configured budget.
- Destructive database or infrastructure operations.
- Real-money payment, refund, or settlement actions requiring operator authorization.
- Cross-silo operations.

## Freeze conditions

- Unknown state.
- Missing or corrupt proof.
- Render/Vercel release mismatch.
- Repeated identical deployment failure.
- Rate limiting. Back off rather than hammer.
- Unexpected spend.
- Destructive operation without explicit approval.
- Cross-silo access.

## Economic progression

OFFER -> CHECKOUT -> PAYMENT PROVIDER EVENT -> WEBHOOK -> SETTLEMENT RECORD -> FULFILMENT -> CUSTOMER OUTCOME -> REVENUE PROOF -> NEXT ITERATION

A checkout URL is not revenue proof.

## DreamMeez naming

DreamMeez is the canonical user-facing brand. Legacy spellings must not be reintroduced into active product copy. Machine identifiers and historical evidence are changed only when compatibility has been established.

## Silo boundary

MTG / HappyHomarid / CollectorsCoast and Amplissa / adult remain hard-separated. Any cross-silo write or generated content is a hard freeze.

## Operator-off target

The machine should be able to monitor, diagnose, build, test, commit, push branches, run CI, deploy approved infrastructure, probe production, write proof, queue bounded repairs, and sleep/wait. It must stop and surface an operator decision when an approval gate is reached.

## Truth rule

NO EVIDENCE = NO STATE TRANSITION.

The system must never manufacture a PASS state from an intended action, a CLI exit code alone, a deployment URL alone, or an unverified payment claim.
