# BrownEye Control Plane Architecture Harvest

## Purpose

Shorten BrownEye build time by harvesting mature external architecture, code, test corpora, protocols, and operational patterns before writing bespoke machinery.

The rule is **reuse first, synthesize second, build last**.

External implementations are inputs to the Truth Oracle. Their existence never establishes that they are correct, secure, production-ready, or equivalent to BrownEye.

## Acquisition classifications

- `VENDOR`: use the external project substantially as an operational dependency when license, security, maintenance, deployment and authority boundaries pass the Oracle/Gauntlet.
- `ADAPT`: transplant reusable code or architecture into BrownEye and make it conform to BrownEye contracts.
- `REFERENCE`: borrow architecture, schemas, tests, invariants, threat models or UX patterns without importing runtime code.
- `REJECT`: evidence, license, security, maintenance or architectural mismatch is too severe.
- `REPLACE`: external project is already better than a BrownEye implementation; retire the redundant BrownEye implementation after migration proof.

Never copy code merely because it is available. Record license, provenance, version/commit, security posture, maintenance activity, dependencies, compatibility, and exactly what was borrowed.

## Harvest matrix

| Domain | What to harvest | Preferred disposition | BrownEye invariant |
|---|---|---|---|
| Governance | authority boundaries, approvals, kill switches, risk tiers | ADAPT/REFERENCE | agents propose; control plane authorizes |
| Evidence | claim/evidence schemas, provenance, source weighting, verification receipts | ADAPT | no claim becomes VERIFIED without evidence |
| Adversarial evaluation | attack corpora, chaos injectors, judges, regression suites | ADAPT | every irreversible path has a hostile test |
| Durable execution | checkpoints, leases, retries, recovery, idempotency | ADAPT/VENDOR | crash recovery cannot duplicate side effects |
| Agent identity | scoped identities, delegation chains, capability tokens | ADAPT | identity is separate from authority |
| Policy admission | deny-by-default, capability scopes, conditions, budgets | ADAPT | execution requires an admission decision |
| Observability | traces, audit logs, decision records, correlation IDs | ADAPT | governance decisions are durable evidence, not ephemeral logs |
| CI/CD | promotion gates, artifact proofs, rollback, GitOps | ADAPT/REFERENCE | CI proves artifacts before release |
| Orchestration | workflow graphs, queues, workers, scheduling, state machines | ADAPT/VENDOR | orchestration cannot bypass policy gates |
| Memory | durable context, provenance, retrieval, versioning, forgetting/expiry | ADAPT | memory is evidence-bearing, scoped and revocable |
| Economic ledgers | double-entry/REA patterns, immutable receipts, cost attribution | ADAPT/REFERENCE | market outcomes become evidence |
| Self-improvement | proposal loops, evaluation-driven mutation, regression memory | ADAPT/REFERENCE | self-improvement proposes only; human/control gates authorize |

## First harvest candidates

### Control plane / governance

1. `boundflow/boundflow` — Apache-2.0 backend, MIT Python SDK. Harvest policy-dictated lifecycle control, approvals, durable execution, audit logging, worker/control-plane separation and OpenTelemetry boundaries. Current status: `ADAPT` candidate, not production-proven by existence alone.
2. `ryanwi/agent-control-plane` — MIT. Harvest deterministic policy enforcement, approval gates, budgets, kill switches, preconditions, durable event history, replay and recovery. Current status: `ADAPT` candidate.
3. `preloop/preloop` — inspect for MCP firewall, model gateway, policy-as-code and human approval UX. Current status: `REFERENCE` pending license/security/architecture review.
4. `agentlifylabs/Aegis` — inspect deny-by-default capability policy, hash-linked audit events and deterministic replay. Current status: `REFERENCE` pending code/licence review.
5. `45ck/Portarium` — inspect policy, approvals, orchestration and evidence architecture. Current status: `REFERENCE` pending code/licence review.

### Adversarial evaluation

1. `Sub2mval/AgentGauntlet` — harvest context/tool/instruction/data chaos injection. Current status: `ADAPT` candidate.
2. `gauntlet-benchmark/evaluation-harness` — harvest modular task environments, evaluator separation and objective scoring. Current status: `REFERENCE`.
3. NVIDIA Live Agent Gauntlet — harvest competition/benchmark methodology, not proprietary implementation. Current status: `REFERENCE`.

### Orchestration / durable execution

1. `dapr/dapr-agents` — inspect durable workflows, state recovery, retries, actor/workflow separation and observability. Current status: `REFERENCE` pending BrownEye footprint analysis.
2. BoundFlow — inspect checkpoint/lease/recovery model before writing another worker state machine. Current status: `ADAPT` candidate.

### Evidence / truth

Use Facticity/ArAIstotle as an architectural reference for an explicit verification service, but do not treat vendor-reported accuracy as BrownEye evidence. BrownEye must maintain its own source-linked evidence and confidence model.

Elohim Protocol is a reference for constitutional agents, provenance, governance-coupled records and economic accounting. It is not adopted as BrownEye infrastructure merely because the vocabulary overlaps.

## Harvest workflow

`DISCOVER → LICENSE → SOURCE INSPECT → ARCHITECTURE EXTRACT → SECURITY REVIEW → BENCHMARK → ADAPT/VENDOR/REFERENCE/REJECT/REPLACE → TRUTH ORACLE → GAUNTLET → CI → RECORD PROVENANCE`

Each candidate receives a harvest record containing:

- repository and exact commit/tag
- license
- maintenance/activity snapshot
- dependency footprint
- security/threat model
- capabilities harvested
- code imported, if any
- BrownEye adaptations
- tests borrowed
- known incompatibilities
- disposition
- Oracle verdict
- Gauntlet verdict
- rollback/removal plan

## BrownEye non-negotiables

1. Supabase/Postgres remains authoritative for shared state where BrownEye already declares it authoritative.
2. Browser/client state never becomes authoritative merely because an external framework prefers local state.
3. No external agent receives unrestricted production credentials.
4. Proposal generation never grants execution authority.
5. Truth Oracle never becomes the sole source of truth for its own claims.
6. Gauntlet can block release but cannot silently mutate production.
7. Human approval remains mandatory for configured high-impact actions.
8. Every irreversible action receives a durable receipt.
9. Market outcomes are measured independently from model claims.
10. Borrowed code must remain traceable to its source and license.

## Supabase shared epistemic registry

The canonical shared registry lives in Supabase:

- `control_plane_artifacts`
- `truth_oracle_claims`
- `truth_oracle_evidence`
- `truth_oracle_runs`
- `control_plane_handoffs`
- `control_plane_truth_oracle_context(subject)`

Claude and other connected agents should inspect this registry before proposing duplicate infrastructure. The registry is the shared epistemic handoff, not a replacement for source code or deployment state.

## Immediate harvest order

1. Governance/admission
2. Truth/evidence
3. Gauntlet/chaos
4. Durable execution
5. Identity/capabilities
6. Observability/audit
7. CI/CD/release
8. Orchestration
9. Memory
10. Economic ledger
11. Self-improvement

The first objective is not maximal feature coverage. It is to remove bespoke machinery from the path to the first verified economic outcome.
