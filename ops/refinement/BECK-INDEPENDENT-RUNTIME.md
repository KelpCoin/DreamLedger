# BECK owner-controlled runtime: migration away from ChatGPT dependence
Status: MIGRATION_IN_PROGRESS_SOURCE_ONLY | 2026-10-28

## Invariant
BECK owns its source code, inference policy, scheduled jobs, manifests, telemetry, commerce proofs and approval history. ChatGPT is an optional operator interface, not a required execution engine, scheduler, decision memory, buyer identity, ledger, payment authority, artifact store or handover location.

An OpenAI-compatible HTTP chat-completions JSON endpoint is a protocol, not a mandatory ChatGPT subscription or OpenAI service. The existing local refinement runner defaults to loopback LM Studio; the PowerShell bootstrap targets loopback Ollama. Both run independently of the ChatGPT app when properly installed.

## Plan to migrate with no silent regression
1. **State:** approved source and tests live in Git, private operational proofs on owner-managed Windows storage, commerce truth in reconciled Stripe/database events. Never treat chat transcripts or public Actions artifacts as a source of economic truth.
2. **Inference:** prefer local Ollama/LM Studio with at least two distinct models. External cloud inference remains opt-in, with explicit budget, model IDs and privacy rules. No silent fallback to ChatGPT.
3. **Scheduling:** Windows Task Scheduler executes read-only local model research. GitHub CI can validate deterministic contracts while PC is off. Existing ChatGPT-scheduled revenue watches are not to be disabled until a independently verified alternative reproduces their outputs.
4. **Memory:** external pages and model outputs remain untrusted candidate claims. Only records corroborated with a system-of-record receipt or an authorized human decision can be promoted; a hash chain does not establish factual truth.
5. **Tools:** BECK MCP uses independent approved manifest hash pinning, rechecked on tool calls. Models do not approve payments, publications or new powers. No MCP plugin provider is required for BECK commerce runtime.
6. **Commerce:** buyer-visible listing bound to consent, settled payment, unique transaction claim, a delivery receipt and refund reconciliation remain model-independent. No raw third-party content can authorize payment.
7. **Portability:** export model-neutral JSON evidence and SHA receipts; an owner can change model/provider without changing the proof schema, storefront or order ledger.

## Completion gates
- Real Windows scheduled task registered and one genuine successful run with two different local models, hashes and artifacts, observed on the user's machine.
- Live storefront commit and domain verified, not just merged source.
- BECK can ingest demand, propose original cosmetics and test a proposed change without a ChatGPT conversation. All generated patches require owner approval.
- Tool drift and memory poisoning regression tests demonstrably pass in the operating runtime, not just a source scan.
- Real external Stripe payment, buyer identity, durable claim, fulfilment proof and reconciliation verified independently.
- Every critical ChatGPT-based recurring watch has an independently monitored owner-operated replacement before being retired.

## Important boundaries
- Current local-model bootstrap has not been installed or observed on the user's Windows device.
- No real GGUF model files or Hugging Face publisher revisions have been independently audited; a hash alone does not establish the absence of malicious weights.
- Vercel rejected the last production deployment with HTTP 403. Git merges are not deployments.
- Cross-instance webhook idempotency and the real paid DreamMeez entitlement pipeline are not proven.
- Some historical BECK scripts may still use provider-specific services; do not claim migration complete without an audited inventory.

Finance, legal matters, public posting and product releases retain both founder approval gates. Replacing ChatGPT as the center of BECK is a controlled engineering transition, not a deletion of useful working monitors.
