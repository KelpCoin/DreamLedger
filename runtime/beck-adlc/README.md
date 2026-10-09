# BECK ADLC: bounded execution

This is the first executable policy and test-executor slice of BECK's Agent Development Lifecycle. It reuses DreamLedger's existing authority and truth boundaries and creates no second queue, ledger, orchestrator, or truth system.

## Current scope

- `beck_contract.json` defines the proposed policy contract.
- `policy.py` deterministically evaluates structured intents and fails closed.
- `executor.py` defines the bounded execution boundary: policy check, exact action/target registry, idempotency reservation, one registered action, and evidence hash. The persistence store is injected and must atomically reserve keys and persist result plus evidence.
- `test_policy.py` contains 12 policy unit tests.
- `test_executor.py` contains 7 executor-harness tests: one authorized fixture action, unauthorized target rejection, unapproved authority, missing adapter, replay without a duplicate action, in-progress replay rejection, action timeout/failure, and evidence-hash verification.
- The only executable test action returns a `TEST_ONLY` fixture value. It is not a production action.

**This is not yet a production executor.** The current tests use an ephemeral in-memory store. No production store, trusted authority-signature verifier, live action adapter, or production deployment is connected. The contract remains `PROPOSED` with an empty action allowlist, so it cannot authorize real actions. A successful fixture test proves only the harness contract, not an external effect or revenue.

## Run tests

From repository root:

    python -m unittest discover -s runtime/beck-adlc -p 'test_*.py' -v

## Five lifecycle gates

1. **Specify:** approve a versioned contract with action types, targets, budgets, authority claims, and evidence fields.
2. **Build:** connect only to existing Figure Eight/Gauntlet and economic state/evidence modules. Do not expose production secrets to generated code or permit arbitrary shell/network access.
3. **Verify:** run unit, integration, adversarial, replay, concurrency, and failure-injection tests. This suite is a starter gate, not production certification.
4. **Release:** sandbox first; verify rollback, health, atomic idempotency persistence, and evidence integrity. Production deployment needs separate reviewed authorization.
5. **Operate:** quarantine on scope/authority/evidence violations. Repairs are new reviewed candidates, never self-authorized scope changes.

## Production integration requirements

- Authenticate the authority record from the trusted authority source.
- Bind authorization to intent ID, action type, target, expiry, and contract version.
- Implement atomic idempotency reservation and result/evidence persistence through the existing persistence layer.
- Enforce limits at the adapter boundary, not only in the policy evaluator.
- Record attempted, dispatched, externally-sent, result-observed, and unknown states separately.
- Persist evidence before reporting completion; missing evidence fails closed.
- Add adapter-level timeout, cancellation, retry, rollback, and concurrent-replay tests.
- Prove Supabase data-plane health before database writes.
- Keep TEST/SIMULATED/INTERNAL separate from VERIFIED external outcomes and revenue.

A passing unit test is evidence about this policy/harness only, not a deployed BECK service, a completed external action, or revenue.
