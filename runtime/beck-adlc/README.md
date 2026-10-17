# BECK ADLC: bounded execution

This is the first executable policy and test-executor slice of BECK's Agent Development Lifecycle. It reuses DreamLedger's existing authority and truth boundaries and creates no second queue, ledger, orchestrator, or truth system.

## Current scope

- `beck_contract.json` defines the proposed policy contract.
- `policy.py` deterministically evaluates structured intents and fails closed.
- `executor.py` now requires an injected `AuthorityProvider.resolve_verified(...)` boundary rather than accepting an authority grant directly from the caller. The production provider must retrieve and cryptographically verify a trusted grant; the test provider is only a fixture and does not verify signatures.
- The executor requires an injected persistence store for idempotency reservation and result/evidence persistence. Current tests use an ephemeral in-memory test double, not durable production storage.
- `test_policy.py` contains 12 policy unit tests.
- `test_executor.py` contains 9 executor-harness tests, including authority-provider outage, grant scope mismatch, action timeout with UNKNOWN outcome, and receipt-persistence failure after the fixture action returns.
- The only executable action returns a `TEST_ONLY` fixture value. It is not a production action.

**This is not yet a production executor.** No production authority verifier, persistent store, live action adapter, or deployment is connected. The contract remains `PROPOSED` with an empty production action allowlist. The SHA-256 evidence checksum is integrity-checkable but is neither a signature nor independent proof of an external effect.

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

- Implement the authority provider using the trusted Figure Eight authority source or a signed grant from the existing canonical store; verify signature, issuer/key epoch, scope, expiry, revocation, and contract version.
- Bind authorization to intent ID, action type, target, expiry, and contract version.
- Implement atomic durable idempotency reservation and result/evidence persistence through the existing persistence layer.
- Treat external side effects as a separate failure domain. A database transaction cannot roll back an arbitrary remote payment/API effect. Use an intent/effect-receipt/outbox pattern where supported, and reconcile ambiguous outcomes by querying the provider. Never retry an UNKNOWN effect blindly.
- Enforce limits at the adapter boundary, not only in the policy evaluator.
- Record attempted, dispatched, externally-sent, result-observed, and unknown states separately.
- Persist evidence before reporting completion; missing evidence fails closed.
- Add adapter-level timeout, cancellation, retry, rollback/compensation, quarantine, and concurrent-replay tests.
- Prove Supabase data-plane health before database writes.
- Keep TEST/SIMULATED/INTERNAL separate from VERIFIED external outcomes and revenue.

A passing unit test is evidence about this policy/harness only, not a deployed BECK service, a completed external action, or revenue.
