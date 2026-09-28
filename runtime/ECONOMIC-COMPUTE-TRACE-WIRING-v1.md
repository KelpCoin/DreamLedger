# ECONOMIC COMPUTE TRACE WIRING v1

Status: WIRED, AWAITING NEXT GENUINE WORKER EXECUTION
Date: 2026-09-29

## Change made

The existing economic fulfillment worker now imports the compute-trace module and creates an immutable execution trace envelope immediately after claiming a genuine economic fulfillment job.

The runtime path is now:

CLAIM JOB
-> CREATE ECONOMIC_TRACE_ID
-> DISCOVERY / SOURCE FETCHES INCREMENT TOOL COUNT
-> EXECUTE FULFILLMENT
-> CLOSE TRACE
-> WRITE TRACE ARTIFACT
-> UPLOAD TRACE WITH JOB ARTIFACTS
-> EXISTING COMPLETION RPC

Failures use the same trace boundary:

CLAIM
-> CREATE TRACE
-> FAILURE
-> CLOSE TRACE AS FAILED
-> WRITE TRACE
-> ATTEMPT TRACE UPLOAD
-> EXISTING FAILURE RPC WITH TRACE ID

## Existing-path bindings

The worker derives optional bindings from the existing job/payload without changing the economic schema:

- ACTION_ID from payload.action_id or payload.economic_action_id or job.action_id
- OPPORTUNITY_ID from payload.opportunity_id or job.opportunity_id

Absent identifiers remain absent. The runtime does not invent economic action or opportunity identity.

## Cost semantics

The trace initializes:

- actual_provider_cost = null
- estimated_provider_cost = null
- compute_cost_status = UNKNOWN
- cost_status = UNKNOWN

Therefore the new instrumentation cannot silently report zero inference cost.

Provider/model values are taken from optional runtime environment variables:

BEC_MODEL_PROVIDER
BEC_MODEL

If absent they remain UNRECORDED.

## Resource semantics

Normal completion records worker resource status AVAILABLE.

Unhandled worker failure records:

- worker_resource_status = FAILED
- failure_class = WORKER_FAILURE

The existing failure reason remains authoritative for the economic worker state.

The previously observed WORKER_RESOURCE_LIMIT / HTTP 502 event is preserved as a regression fixture in the trace contract, but this wiring does not retroactively rewrite that historical event.

## Artifact persistence

Successful jobs now persist:

economic_compute_trace.json
report.md
results.csv
result.json

Failed jobs attempt to persist and upload economic_compute_trace.json before invoking the existing failure RPC.

Trace storage path:

economic-jobs/<job_id>/economic_compute_trace.json

The trace is evidence of runtime consumption only. It is not revenue evidence.

## What is now proven

Static implementation facts:

1. Genuine worker execution creates a trace before fulfillment begins.
2. Source fetches increment tool-call count.
3. Unknown provider cost remains UNKNOWN.
4. Failures receive a terminal trace.
5. Trace artifacts are included in successful artifact persistence.
6. Failure traces are uploaded before failure completion when storage permits.
7. Existing economic completion/failure RPCs remain the authority for worker state.
8. No VERIFIED revenue state is created by tracing.

## What remains unproven

The first live worker execution after this commit must demonstrate:

ACTION_ID
-> ECONOMIC_TRACE_ID
-> real source/tool observations
-> worker result or failure
-> persisted trace artifact

Only then is the runtime trace operationally observed rather than statically wired.

If the live worker fails because of resource limits, that failure itself is useful evidence and must remain preserved.

## Economic boundary

This change intentionally does not:

- create revenue;
- create a buyer;
- create settlement;
- create fulfillment truth;
- change Stripe truth;
- alter external-economic baseline;
- authorize an action;
- classify a provider as a chokepoint.

The trace layer measures the operator's cost of acting. The existing truth machinery decides whether the outside world actually paid.
