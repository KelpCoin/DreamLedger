# BECK Cloud/Local Figure Eight

Status: implementation target, 2026-09-18

The system has one control/evidence plane with two compute locations. Cloud services provide durable orchestration, evidence, economic truth, public surfaces and payment processing. The local node provides private semantic compute through LM Studio/llmster and returns bounded results through the existing leased bridge.

## Runtime loop

REQUEST -> GOVERNOR -> CAPABILITY REGISTRY -> EXISTING ASSET OR BOUNDED CREATION -> ELOHIM/LOCAL COMPUTE -> GAUNTLET -> VERIFIED CAPABILITY -> ALLOCATION -> USE -> EVIDENCE -> TRUTH ORACLE.

A capability is reusable only after it satisfies the relevant technical and policy gates. Creation is not proof of value. Payment, fulfillment and real-world outcome remain separate evidence states.

## Figure-eight

Cloud -> bounded job -> local compute -> structured result -> cloud evidence/control -> future allocation.

For resilience, the local node may cache approved capability manifests and queue bounded work while disconnected. It must never invent economic truth. When connectivity returns, receipts reconcile through the authoritative cloud ledger.

## Governor responsibilities

- classify requests;
- find an existing capability before creating one;
- decide whether a bounded creation attempt is justified under existing policy;
- route work to an available compute worker;
- require Gauntlet acceptance before a new capability becomes reusable;
- surface human gates and exceptions.

## Gauntlet responsibilities

The Gauntlet judges artifacts and proposed capability changes against explicit acceptance rules. It does not turn internal generation into economic evidence.

## Truth Oracle responsibilities

Truth Oracle is the public evidence surface. It exposes the current evidence state, provenance, freshness, contradictions and unknowns without changing the underlying record for commercial or access reasons.

## Website integration

Public surfaces may consume approved capabilities through stable interfaces. They should request a capability by identity and version, not know which model or worker produced it. If a capability is absent, the request enters the control plane instead of silently triggering uncontrolled creation.

## Fallback boundary

Current cloud/local transport is implemented. Full cloud-independent continuation is not claimed until local durable state, offline queueing, reconciliation and recovery have been exercised in an outage test.

## Non-goals

No second orchestrator. No second economic ledger. No automatic revenue claims. No unrestricted public agent authority. No autonomous spending or consequential public release without the existing approval gates.
