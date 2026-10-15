# LMSTER Headless Worker Contract v1

**Lifecycle:** Draft contract, not deployed.  
**Cloud authority:** Supabase / DreamLedger.  
**Local accelerator:** LM Studio **llmster** headless daemon, localhost API only.  
**Revenue truth:** Worker output never establishes settlement, fulfillment, or verified revenue.

## 1. Objective

Remove routine human operation from local model execution without putting commerce, settlement, or silo publication behind the user's PC. The cloud continues to receive and verify payments while the PC is offline. When the PC is awake, an authenticated, capability-checked LMSTER worker may claim a bounded analysis job, execute the configured Tri-LLM stages, checkpoint each stage, and submit an evidence receipt.

The worker is an execution node, not an economic authority.

## 2. Existing DreamLedger substrate to reuse

Do not build a second silo factory or queue.

- **BEC-PRIME/factory/FactoryFactory.js** compiles eligible opportunity packets.
- **BEC-PRIME/factory/UniversalFactoryCompiler.js** compiles universal money-cell candidates.
- **BEC-PRIME/factory/MechanismReplicationGate.js** refuses replication unless an independent external buyer, settled payment, correct attribution, fulfillment, and independent proof are all true.
- **supabase/migrations/20260927_create_economic_silo_factory_registry.sql** defines the existing economic silo registry, factory batches, and silo agent runs.
- **supabase/migrations/20261007150000_expand_500k_economic_silo_population.sql** describes logical candidate population. A candidate count is not a count of deployed, buyer-validated, or revenue-producing businesses.
- **supabase/migrations/20260923212000_figure_eight_worker_api_complete_v6.sql** defines the service-role-only **figure_eight_worker_api** on the private **figure_eight** schema. It supports bounded worker/control-plane operations, but it is not itself the proposed local-model job gateway.
- The deployed **agent-bridge-proxy** currently exposes an allowlist of **jobs**, coordination/evidence tables, and **claim_job**, **renew_job**, **complete_job**, **fail_job**, and **reclaim_expired_jobs** RPCs. The inspected bridge returns action-safety metadata but does not enforce that metadata as the authorization gate. Do not hand its broad credential to the local worker.
- The existing economic fulfillment RPCs (**claim_economic_fulfillment_job**, **complete_economic_fulfillment_job**, and **fail_economic_fulfillment_job**) serve the separate commerce-fulfillment path. Do not use a fulfillment job to represent a model-analysis task.

A live, read-only database/schema inspection timed out during preparation. Migration files in Git prove repository intent, not that every migration has been applied to the connected production project. Do not infer live schema, RPC signatures, lease semantics, or migration state from repository files alone.

## 3. Trust boundaries

1. **Cloud is authoritative.** Only provider-backed server code determines payment verification and settlement. Only server-side commerce logic attributes settled payment to a silo, records fulfillment, accepts delivery proof, or promotes a silo.
2. **The local worker is untrusted.** It returns structured analysis, hashes and private artifact references. It cannot set settlement fields, promote silos, publish, advertise, message customers, rotate secrets, run arbitrary SQL, or spend money.
3. **Credential is narrowly scoped.** Use a dedicated **lmster-worker-gateway** token. Never put Supabase service-role/secret keys, Stripe secrets, or wallet private keys on the PC. Never reuse the broad **agent-bridge-proxy** token.
4. **Outbound-only network.** The worker calls the gateway over HTTPS. The model API binds to **127.0.0.1**; never bind port 1234 to **0.0.0.0**, router forwarding, or a public tunnel.
5. **Job content is data, not instructions.** A document, webpage, input payload or model output cannot authorize shell execution, browsing, secret reads, arbitrary tool calls, deployments, or external communication.
6. **A hash is not truth.** SHA-256 identifies bytes. It does not independently prove accuracy, model agreement, settlement, legal compliance or delivery.

## 4. Proposed narrow gateway

The route contract is recorded in **BEC-PRIME/contracts/lmster/gateway.openapi.yaml**. These routes are a proposal, not a claim that a deployed function already serves them.

Every operation resolves a dedicated worker token to a server-side worker identity and capability scope. Request-body worker ID, silo ID, namespace, manifest, lease owner and payment status are never trusted as authoritative. The gateway derives them from the authenticated credential, authoritative job, and registered silo manifest.

| Operation | Required behavior |
|---|---|
| POST /claim | Atomically lease one compatible analysis job, or return IDLE. A claim is not evidence of work or revenue. |
| POST /input | Return only input authorized for the active lease plus a server-computed digest. |
| POST /renew | Renew only the caller's still-valid lease and lease generation. |
| POST /heartbeat | Report worker availability and model-role capability only. |
| POST /checkpoint | Accept an idempotent stage checkpoint only for the current lease and matching input/prompt/schema/model digest. |
| POST /complete | Stage an analysis result for cloud validation. Must not set payment, fulfillment, delivery, or economic-truth state. |
| POST /fail | Record a bounded error code, retryability and diagnostic digest under a cloud-controlled retry policy. |

Required failure responses: 401 absent/invalid token; 403 scope violation; 409 expired lease or conflicting idempotency reuse; 422 invalid request or unknown task type; 503 unavailable backend. A claim with no work returns HTTP 200 with status IDLE and retry_after_seconds 30.

Do not implement these routes by proxying arbitrary table names or caller-selected RPC names. The gateway must have a literal allowlist and fixed server-side database operations. Reject every route not defined in the contract.

## 5. Job protocol and leases

The strict job envelope is **schemas/job-envelope.schema.json**.

Each accepted job includes protocol version, stable job ID, stable idempotency key, server-issued lease ID and generation, expiry, worker ID, silo/namespace/manifest digest, allowlisted task type, input digest, prompt pack digest/version, output schema version, permitted models, resource caps, and server-validated checkpoint references.

Suggested initial limits: one concurrent job, lease TTL 180 seconds, renewal every 30 seconds, local worker considered stale after 90 seconds, maximum five total job attempts and at most two model retries per stage. These are versioned configuration defaults, not observed production settings.

- A claim operation must be atomic: only one current worker owns a lease generation.
- Every mutating operation validates worker identity, job ID, lease ID, lease generation, and lease expiry server-side.
- A dead worker's lease expires and is reissued by the cloud. A cached local lease is never authority.
- Checkpoints are keyed by job, lease generation, stage, input digest, prompt digest, model ID and output schema version.
- Retries may reuse only cloud-accepted checkpoints that match all the same digests and versions.
- Duplicate identical checkpoint/receipt posts return the previously accepted result. A conflicting duplicate fails closed.
- Re-inference may happen after a crash, but the worker has no permission to perform external side effects, so recovery cannot cause duplicate purchases, publication, or customer messages.

## 6. Fail-closed Tri-LLM workflow

Strict output schemas are in **schemas/tri-llm-result.schema.json**. Use three explicitly configured, independently recorded roles.

### Extractor
Extract only source-grounded facts. Each fact must name a source reference and quote or locator that can be resolved against the input. Unknown values are UNVERIFIED. Invalid JSON, unknown fields, missing evidence, timeout, truncation or digest mismatch fails the stage.

### Gauntlet / critic
Independently challenge the extraction and return PASS, BLOCK, or UNVERIFIED, with issue codes. It cannot waive any policy gate. Deterministic arithmetic and domain rules run in ordinary code, not in an LLM. For quote normalization, GST/tax arithmetic must use an explicitly versioned decimal calculation rule and reported source values.

### Elohim / synthesizer
Return only the schema's permitted verdict enum. It can summarize the permitted evidence and identify blockers. It cannot invent source facts, override a critic block, claim money settled, or approve publication.

### Deterministic final policy
The final verdict is computed by policy code, never copied directly from model prose. VERIFIED_MATCH requires valid input digest, valid source references, valid schemas, all mandatory stage passes, all required deterministic checks passing, valid manifest and no unresolved contradictions. Otherwise return UNVERIFIED, CONFLICT or BLOCKED. Model agreement alone is not ground truth.

## 7. Evidence receipt

The receipt schema is **schemas/evidence-receipt.schema.json**. It binds:

- job, idempotency key, lease and worker identity;
- authoritative silo ID, namespace and manifest digest/version;
- input/output artifact references and SHA-256 digests;
- model IDs/versions for all three roles;
- prompt pack hash, schema versions and worker build;
- stage verdicts, deterministic checks and accepted checkpoint references;
- start/completion timestamps, canonicalization and receipt digest.

The cloud revalidates the receipt against the active lease, authoritative job, allowed models, silo manifest, input digest and accepted checkpoint records. The cloud recomputes the policy verdict and appends the canonical evidence record. Worker timestamps are telemetry, not settlement timestamps.

Do not place raw documents, personal data, full prompts or full model outputs into the general ledger when private artifact references and digests suffice.

## 8. Economic and publication gates

A worker receipt represents **analysis submitted**, not paid fulfillment.

A silo is not a proven winner until the cloud can independently establish all five commercial facts: an independent external buyer, authoritative payment settlement, correct payment/order/silo attribution, successful fulfillment, and delivery proof. For Stripe, payment_status=paid alone is not necessarily enough if mode, order mapping, webhook/ledger idempotency or fulfillment receipt is wrong. For x402, a 402 challenge or verification response is not settlement; use the configured facilitator/provider's authoritative settlement confirmation tied to the same job/flow/silo.

The existing replication gate already codifies **NO_VERIFIED_TRANSACTION_NO_CLONING**. Keep it authoritative. Candidate discovery may run automatically; public publication, paid advertising, new spend, legal/compliance claims, secrets/payment-rail changes, migrations and other irreversible actions remain approval-gated. No LLM output changes the revenue truth value.

Measure per-job and per-silo costs including inference, retries, cache, API fallback, storage, payment/provider fees and support time. Promote only on measured contribution margin and repeatable demand, not raw candidate count or unverified EPV estimates.

## 9. Local headless runtime

The supported local startup path uses the LM Studio **llmster** daemon and CLI, starting with **lms daemon up** and **lms server start --port 1234 --bind 127.0.0.1**. See the official [headless runtime documentation](https://lmstudio.ai/docs/developer/core/headless).

**Start-LMSTER-Headless.ps1** is only a local server launcher. **Install-LMSTER-StartupTask.ps1** creates a current-user logon task with limited privileges. Neither is a cloud queue consumer, neither authenticates a worker, and neither proves an LLM inference result. The actual queue-consuming worker and narrow cloud gateway are a separate implementation phase.

Before a worker is considered available, the cloud must validate its credential, fresh heartbeat, configured role models and successful inference probe. Otherwise mark the local capability unavailable and leave work queued or use an explicitly allowed cloud fallback. Never make payment processing dependent on local availability.

## 10. Required contract tests

1. Missing/invalid token cannot claim, renew, read input, checkpoint or submit results.
2. Credential cannot see another worker's jobs or cross silo/namespace scope.
3. Invalid/unknown task type fails before model inference.
4. Duplicate claim does not create two active leases.
5. Expired lease cannot checkpoint or complete.
6. Identical duplicate checkpoint/receipt is idempotent; conflicting duplicate is rejected.
7. Kill worker after every stage, expire the lease, reclaim and resume only from digest-matching server checkpoints.
8. Malformed JSON, unknown verdict, critic BLOCK, UNVERIFIED, failed calculation, unresolved source reference, model timeout, prompt mismatch or digest mismatch all fail closed.
9. Successful local output cannot change payment, order, fulfillment, delivery, publication or revenue state.
10. Stale heartbeat (>90 seconds) marks local capability unavailable.
11. Tests use synthetic jobs and test credentials; no live payment, public action or secret mutation.

## 11. Verified status at the time this contract was drafted

- Repository source shows the FactoryFactory/UniversalFactoryCompiler/MechanismReplicationGate and the silo registry, batch, agent-run, and Figure Eight private worker API migrations.
- Connected Supabase reports **agent-bridge-proxy** active at v13 and **marketplace-diagnostic-delivery** active at v10.
- Recent **marketplace-diagnostic-delivery** function logs show **STRIPE_CONFIG_MISSING**; its execution returns 503 before retrieving the Checkout Session or reading marketplace_orders.
- Read-only PostgreSQL queries and migration listing timed out. The live database schema/migration/RPC signature state is not verified.
- No dedicated **lmster-worker-gateway** was listed in the connected Edge Function inventory.
- This document and its schemas are specifications. They are not deployed gateway/worker code and do not constitute revenue evidence.

**Next implementation gate:** restore a successful read-only schema probe, verify live jobs and RPC signatures/lease semantics, then implement and test the narrow gateway over the existing queue. Do not add another queue table or give LMSTER the broad bridge credential to bypass the blocker.
