# BECK Productization and Go-to-Market Plan

Status: PRODUCT STRATEGY / VALIDATION REQUIRED. This is a plan, not a claim that a public package, hosted tier, benchmark, or sale already exists.

## North star

Package the smallest reusable, deterministic action-governance runtime as an open-source developer tool, then sell hosted convenience and enterprise operations. The product promise is not “AI safety solved”; it is a bounded, inspectable enforcement layer for explicit action policies, approval, and evidence.

## Critical boundary: do not publish the whole BECK kingdom

The existing repository contains DreamLedger-specific adapters, private-silo references, deployment code, integrations, and third-party dependencies. Do not copy the full repository, private curriculum, credentials, secrets, internal data, or production adapters into a new public product. Extract a small, dependency-audited core into a separate public repository only after ownership/license and dependency checks. The user-proposed `bec_runtime.py` was not found at that path during repository search, so first locate the actual canonical source or write a clean minimal implementation from the public contract. Do not claim the current BECK runtime is stdlib-only until verified.

## Proposed product tiers (price/currency are hypotheses)

| Tier | Proposed price | Intended scope | Exit gate |
|---|---:|---|---|
| Open source | $0 | Local runtime, deterministic policy decisions, explicit allow/deny/approval, hash-linked receipt format, CLI/API examples, no account required | Clean-room repo, install from source, tests pass, threat model and limitations documented, no DreamLedger dependencies |
| Pro | $49/month or $399/year | Hosted approval UI, signed receipt archive, Slack/Discord notifications, priority updates and security patches | A real hosted path, auth/isolation, retention/export, alert delivery, support burden and payment flow verified |
| Team | $199/month | Multi-agent approvals, team routing, RBAC for approvers/tokens, audit exports, OpenTelemetry | Tenant isolation tests, role/permission matrix, event tracing, team onboarding and paid pilot |
| Enterprise | $50,000/year (currency unconfirmed) | On-prem deployment, SSO, custom policy language, incident response, SLA and compliance reporting | Written buyer requirements, costed delivery/support model, security review, contract and at least one qualified design partner |

Do not advertise pricing until currency, tax treatment, billing cadence, usage limits, support scope, refund/cancellation terms, and hosted cost-to-serve are decided. Enterprise price is a discovery hypothesis, not a quote.

## Product contract

1. Deterministic policy evaluation occurs outside the LLM.
2. Unknown agent, action, or policy state fails closed by default.
3. Approval binds to the exact action payload, policy version, actor/approver, expiry and one-time nonce. Changes to payload invalidate approval.
4. A denied or pending action cannot execute through the product's own enforcement boundary.
5. Receipts are tamper-evident and exportable; never call a receipt a proof that the external world obeyed it unless the external result was observed independently.
6. Credentials are not exposed to the model or written to logs.
7. Explicit limits cover payload size, timeouts, retries, concurrency, and receipt growth.
8. Document what the wrapper can and cannot enforce. A wrapper cannot stop an agent that can bypass it and call the underlying tool directly; use a proxy/gateway or isolated execution boundary when bypass resistance is required.
9. Integrations are separate adapters around the small core. Keep core policy/evidence logic independent from LangChain, CrewAI, AutoGen, LlamaIndex, OpenAI Agents SDK, Claude Agent SDK, MCP, Slack and Discord.
10. Use existing DreamLedger evidence and approval contracts where applicable. Do not create a competing ledger, queue, authorization system or truth source inside DreamLedger.

## Distribution sequence

### Gate 0: source and product audit
- Locate the real canonical runtime source; inspect license headers, contributors, dependencies and private assumptions.
- Make a dependency map and a clean-room public file allowlist.
- Write tests first for default deny, malformed policy, missing approver, replay, expired approval, payload tampering, duplicate receipt, and external action not executed after denial.
- Verify package name availability, PyPI publisher controls, GitHub repository naming, and domain availability before claiming any name.

### Gate 1: public repository
- Publish a small, clean, standalone repository only after source and license audit.
- Apache-2.0 is suitable only for code the owner has authority to license. Include the full LICENSE, preserve third-party notices, and include a NOTICE file where required. Never relicense third-party code by assumption.
- README answers: what it governs, what it does not, install, 60-second demo, policy example, approval flow, evidence schema, threat model, limitations, roadmap and support channel.
- Add CI for unit tests, type/static checks if applicable, dependency and secret scanning, package build, and reproducible release checks.
- Avoid a star-count vanity target. Track installs, successful guarded actions, qualified inbound, active projects, issue quality, paid conversion and retention.

### Gate 2: installable package
- Check PyPI availability for `bounded-runtime` and close variants; no package-name availability is assumed from search snippets.
- Build a minimal package with pinned build tooling, provenance, signed/tagged releases where supported, and a reproducible smoke test.
- Publish only after tests and clean-room install pass. A package upload is a release event, not proof of demand.

### Gate 3: killer demo and docs
- Create a 30-second demonstration with a deterministic, harmless simulated action: unsafe action proposed -> policy denies/holds -> approval bound to exact payload -> receipt emitted -> verifier checks chain. Do not demonstrate destructive production actions.
- Publish integration guides one at a time, starting with the highest measured demand, likely MCP and one agent SDK. Each guide must be tested against the current official SDK and the actual package.
- Publish a comparison page only after evidence-based comparison. Compare public features, enforcement boundary, runtime dependencies, policy model, approval UX, audit evidence, deployment model and limitations. Do not imply endorsement or misrepresent Runbound, Cognis, Keelgate, OpenShell or any competitor.
- Run a benchmark only after a written protocol exists. Publish exact commit, environment, attack set, denominator, failures, confidence limits and reproduction command. Do not claim “under 10% attack success” without observed data.

### Gate 4: founder-led discovery and launch
- Ask 5–10 relevant developers/security leads for short, opt-in interviews; record actual problem frequency, existing alternatives, security requirements and willingness to pay. No spam or fabricated endorsements.
- Publish the repository/README first; then one honest Show HN post, one useful technical article, and one demo clip through channels whose rules permit it. Hacker News discourages AI-generated submissions; any Show HN must be authored and reviewed by the human maker, transparent about AI assistance where applicable, and posted only if its rules allow.
- Reuse each verified artifact across GitHub README, docs, technical post and demo description. No paid ads until organic evidence and unit economics justify spend.
- Ask for feedback, not stars. Do not coordinate fake stars, fake issues, or fake downloads.

## Competitive positioning to validate

Public discussions and launches show many tools already pitch action interception, deterministic policy, human approvals, audit logs and MCP support. BECK must not differentiate on generic “agent guardrails.” Candidate differentiators to test:
- Small core with no account required.
- Payload-bound approval and verifiable receipt contract.
- Explicit distinction between intent, authorization, external execution, and independently observed result.
- One contract shared across CLI, SDK wrappers, MCP and hosted approval UI.
- Clear, honest bypass/threat model and low operational overhead.
These are hypotheses until the extracted implementation and reproducible tests demonstrate them.

## Funnel and scorecard

Track separately: qualified visits -> docs/readme engagement -> install -> successful first guarded action -> repeat use -> hosted trial -> paid subscription -> renewal. Add source attribution without invasive tracking. Track support hours and hosting cost alongside conversion.

Revenue truth requires an independent external buyer, settled payment, delivered hosted capability, and retained delivery evidence. GitHub stars, forks, package downloads, test payments, demo views, queued CI, and generated docs are leading indicators only.

## Immediate order

P0. Audit actual source and license boundaries; locate or create a clean minimal core.
P0. Turn product contract into executable tests and run them.
P0. Confirm currency and tier definitions; price interviews before hosting spend.
P1. Create public repository and README after clean-room gate.
P1. Publish installable package after name check, build and smoke test.
P1. Build demo and one integration guide.
P2. Human-authored launch post and benchmark only after reproducible evidence.
P2. Hosted Pro only after demand signals and an operational-cost model.
P3. Team and Enterprise after paid pilot, tenant/security controls, and support economics.

## Evidence reviewed

- Apache License 2.0 official text and guidance: https://www.apache.org/licenses/LICENSE-2.0.html and https://apache.org/legal/apply-license.html
- Recent public developer-tool discussions include approval gateways, MCP gateways and policy-enforcement runtimes; they indicate competition exists, not that any specific BECK positioning has won.
- Existing DreamLedger code inspected: `BEC-PRIME/runtime/AgentBridge.js`, `BEC-PRIME/runtime/AgentBridgeFencedAdapter.js`, `BEC-PRIME/marketplace/marketplace-runtime.py`, `BEC-PRIME/docs/BECK-AUTONOMY-TRUTH-CONTRACT.md`, and `BECK-CANONICAL-NUCLEUS.md`. These establish reusable pieces and boundaries, not a clean standalone stdlib-only package.
