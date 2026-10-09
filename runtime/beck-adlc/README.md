# BECK ADLC: bounded execution

This is the first executable policy slice of BECK's Agent Development Lifecycle. It reuses DreamLedger's existing authority and truth boundaries and creates no second queue, ledger, orchestrator, or truth system.

## Current scope

- `beck_contract.json` defines the policy contract.
- `policy.py` evaluates structured intents without performing external effects.
- `test_policy.py` covers allow/deny decisions, authority expiry and scope, action/target allowlists, budget limits, missing fields, future timestamps, idempotency conflicts, and evidence-shaped results.

**This is not yet a production executor.** It does not perform external effects, authenticate authority signatures, persist evidence, reserve idempotency keys atomically, or integrate production adapters. The contract defaults to `PROPOSED` with an empty action allowlist, so it cannot authorize actions until a reviewed contract and trusted authority adapter are connected.

## Run tests

From repository root:

    python -m unittest discover -s runtime/beck-adlc -p 'test_*.py' -v

## Five lifecycle gates

1. **Specify:** approve a versioned contract with action types, targets, budgets, authority claims, and evidence fields.
2. **Build:** connect only to existing Figure Eight/Gauntlet and economic state/evidence modules. Do not expose production secrets to generated code or permit arbitrary shell/network access.
3. **Verify:** run unit, integration, adversarial, replay, and failure-injection tests. This suite is a starter gate, not production certification.
4. **Release:** sandbox first; verify rollback, health, idempotency persistence, and evidence integrity. Production deployment needs separate reviewed authorization.
5. **Operate:** quarantine on scope/authority/evidence violations. Repairs are new reviewed candidates, never self-authorized scope changes.

## Production integration requirements

- Authenticate the authority record from the trusted authority source.
- Bind authorization to intent ID, action type, target, expiry, and contract version.
- Atomically reserve and persist idempotency state with the existing persistence layer.
- Enforce limits at the adapter boundary, not only in the policy evaluator.
- Record attempted, dispatched, externally-sent, result-observed, and unknown states separately.
- Persist evidence before reporting completion; missing evidence fails closed.
- Add adapter-level timeout, cancellation, retry, and rollback tests.
- Prove Supabase data-plane health before database writes.
- Keep TEST/SIMULATED/INTERNAL separate from VERIFIED external outcomes and revenue.

A passing unit test is evidence about this evaluator only, not a deployed BECK service, a completed external action, or revenue.