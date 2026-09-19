# BECK Autonomy Truth Contract

Status: DESIGN WRITTEN, CLOUD SCHEDULING OBSERVED, LOCAL MULTI-LLM EXECUTION UNPROVEN

This file replaces the phrase "persistent economic machine" with a testable contract.

## What is actually persistent

The cloud side can continue without a ChatGPT conversation when its schedulers and services are healthy.

Observed control-plane automation includes:

- Supabase pg_cron job recovery and economic dispatch.
- BECK bridge worker and verifier ticks.
- BECK Claude fallback tick.
- CUBE refinery and result reconciliation ticks.
- Local-GPU dispatch tick.
- Loop 001 scheduled cycle.
- GitHub Actions bridge worker every five minutes.
- Render-hosted services for the production runtime.

The database owns durable jobs, leases, objective state, evidence, and economic truth. Scheduled workers can keep processing those queues without a human sending another prompt.

## What is not yet proven

The following are hard gates, not assumptions:

1. Windows is powered on and reachable.
2. LM Studio is running as a local API server.
3. At least three intended local models are loaded or loadable.
4. Each local worker has a distinct worker identity.
5. GPU allocation is actually divided among those model instances.
6. Multiple workers can claim the same persistent objective stream without duplicate completion.
7. A real local worker can complete a job, write evidence, heartbeat, and survive a second cycle without ChatGPT.
8. The local machine can recover after LM Studio, Node, Windows, or network interruption.
9. External economic action remains approval-gated unless authority is explicitly changed.

Until those are observed, the correct label is LOCAL_AUTONOMY_UNPROVEN.

## Definition of the real handoff

The handoff is complete only when this sequence has been observed:

CLOUD OBJECTIVE
-> persistent job
-> local lease
-> LM Studio model A
-> LM Studio model B
-> LM Studio model C
-> shared evidence/result
-> deterministic verification
-> heartbeat
-> second independent cycle

The cloud side may continue during local absence. It must not pretend the local semantic worker completed work that it did not complete.

## Fallback ladder

1. Supabase pg_cron: durable database-side scheduling and lease recovery.
2. GitHub Actions: independent scheduled bridge execution.
3. Render service runtime: independent cloud execution surface.
4. Deterministic DB fallback: recovery, routing, verification, quarantine, and structural bridge work without an LLM.
5. Local LM Studio: semantic work when the Windows machine is online.
6. Optional remote/cloud LLM: only when explicitly configured and budget-authorized.

A fallback may keep the machine moving, but it may not manufacture model output, payment, fulfilment, or revenue evidence.

## Economic truth

No worker, model, scheduler, or assistant may declare a sale.

BusinessTruth requires the existing economic contract:

external buyer + settled Stripe payment + attribution + fulfilment + evidence.

Current verified revenue remains NZ$0 until that condition is met.

## Proof standard

Do not upgrade this document's status from LOCAL_AUTONOMY_UNPROVEN until a real run produces durable evidence for:

- worker identity
- model identity
- GPU allocation
- objective/job ID
- lease ID
- model output
- evidence ID
- verifier result
- heartbeat
- second-cycle completion

That proof is the baton.
