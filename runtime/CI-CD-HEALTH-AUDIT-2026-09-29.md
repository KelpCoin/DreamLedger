# DREAMLEDGER CI/CD HEALTH AUDIT
## 2026-09-29

## Current state

CI_HEALTH = NOT_PROVEN

The repository currently has a substantial GitHub Actions backlog. A direct Actions API observation returned 40,000 workflow runs in the repository history. The latest run associated with the latest economic-diagnosis commit was still queued/pending.

Observed examples on commit ff7b70e57823cfc1e0616b253ec312b29c4a6bce included:

- DreamLedger Gauntlet Release Gate: queued
- BEC-PRIME Gates: pending
- Security Baseline: queued

This means "queued" and "pending" must not be represented as green.

## Measured workflow duplication

The economic runtime currently has overlapping checks:

1. economic-production-observation-contract.yml
   - compiles all runtime/economic Python
   - runs production observation probe
   - runs event projection tests
   - runs state transition tests
   - runs Stripe observation adapter tests

2. economic-event-projection.yml
   - independently runs event projection tests

3. economic-state-transition-contract.yml
   - independently runs state transition tests

4. economic-event-contract.yml
   - checks event vocabulary
   - runs mass-admission tests
   - runs fulfillment tests

5. economic-substrate-live-path.yml
   - runs worker substrate tests

6. swarm-orchestration-contract.yml
   - installs Dapr Agents
   - imports the adapter
   - repeats mass-admission and fulfillment tests

The first three contain genuine overlap. The correct response is not another workflow.

## Immediate containment applied

Concurrency limits were added to the five economic workflows that were inspected:

- economic-production-observation-contract.yml
- economic-event-projection.yml
- economic-state-transition-contract.yml
- economic-event-contract.yml
- economic-substrate-live-path.yml

Each workflow now uses a workflow-specific concurrency group keyed by GitHub ref and cancels an older in-progress run when a newer run supersedes it.

This is a backpressure control, not a claim that the historical queue has been cleared.

## Dependency substrate observation

package.json declares Node >=20 and direct dependencies:

ajv ^8.17.1
qrcode ^1.5.4
@sd-jwt/core 0.20.1

No package-lock.json or npm-shrinkwrap.json was found at repository root.

This is a reproducibility risk because CI can resolve a changing dependency graph.

The repository also contains runtime/swarm/dapr_requirements.txt with:

dapr-agents==1.0.6

The Dapr dependency is pinned.

## Required next CI action

Do not add more CI workflows.

Next actions:

1. verify whether the Actions backlog begins draining after concurrency controls;
2. identify the authoritative economic contract workflow;
3. consolidate duplicate deterministic tests only after observing actual run behavior;
4. add deterministic Node dependency locking only if the repository's existing deployment/build process supports it without introducing a new package-management regime;
5. obtain one completed successful run for the authoritative economic contract;
6. record run ID, SHA, status, conclusion and test scope;
7. only then mark CI_HEALTH = PROVEN.

## Deployment boundary

Render health remains unverified from the current connector session because the service belongs to workspace tea-d7l1ebq8qa3s73fq2cd0 while no workspace is selected in the current Render connector context.

Do not infer production deployment health from GitHub state.

## Economic effect

CI backpressure is an internal reliability blocker.

It does not create revenue.

The purpose of this work is to prevent internal proof/deployment machinery from becoming another source of owner attention or silently masking broken economic code.

The economic frontier remains:

QUALIFIED OPPORTUNITY
-> AUTHORIZED EXTERNAL ACTION
-> EXTERNAL RESULT
-> SETTLEMENT
-> FULFILLMENT
-> VERIFIED OUTCOME

No scoreboard change is justified by CI activity.
