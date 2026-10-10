# Knock-Off Doctrine: Evidence, Failure Inversion, and Safe Adoption

**Date:** 2026-10-10
**Status:** strategy review; external claims graded by available evidence.
**Decision:** adopt pattern replication and competitive improvement. Do not adopt counterfeit identity/assets, unsupported revenue projections, or unreviewed third-party agent code.

## Executive rule

Copy the mechanism that creates customer value, not protected expression, branding, confidential material, or a competitor's implementation. Learn from both success and failure. Each reference pattern must produce a source, observed mechanism, transferable principle, known costs/failures, original implementation, falsifiable test, and stop condition.

A reported success is a case study, not proof that the same outcome is reproducible. A model's agreement is not independent verification. A forecast is not realized revenue.

## Case study lessons and corrections

### Medvi: automation leverage, but not a safe template to copy wholesale

The New York Times reported that Medvi used AI tools to build code, site copy, ads, customer service, and analytics, with $401 million in 2025 sales and a reported $1.8 billion 2026 trajectory. Business Insider subsequently reported concerns about affiliate ads depicting apparently fictitious doctors, questionable credentials, and regulatory/legal scrutiny. Sources:
- https://archive.ph/yyS8E
- https://www.businessinsider.com/medvi-ai-weight-loss-millions-ai-advertising-legal-compliance-challenges-2026-4

**Transferable:** a small team can orchestrate specialized software tools and external partners; automate repetitive production; retain human accountability for high-risk claims and actions.

**Failure to invert:** don't copy deceptive marketing, fabricated testimonials/credentials, regulated healthcare shortcuts, or a high-spend acquisition model. The reported launch involved approximately US$20,000 and outsourced healthcare partners, so it is not a zero-capital template. Revenue scale does not demonstrate the same economics apply to DreamLedger.

### Ravenopus: agents amplify work, but human relationships still mattered

Forbes' author archive lists an August 17, 2026 profile of Ravenopus and says the business uses AI agents to speed workflow but relies on human soft skills to win and build client relationships:
- https://www.forbes.com/sites/elainepofeldt/2026/08/17/this-ebay-alum-built-a-one-person-marketing-agency-with-35-ai-agents/

**Transferable:** specialized agents can increase throughput when paired with a clear workflow and human accountability.

**Failure to invert:** don't assume agents remove customer acquisition, trust, sales, or delivery. The reported reliance on relationship-building conflicts with any assumption software alone guarantees demand. Prefer inbound, marketplace and intent-led discovery where possible, and measure the actual acquisition mechanism.

### Local AI Agent Orchestrator (LAO): candidate for a bounded experiment

The project advertises planner → coder → verifier → reviewer, SQLite state, model swaps, optional Git traces and a local LM Studio-compatible endpoint. Its published license is GPL-3.0-only, and docs warn agent-directed tools can execute shell commands and write files:
- https://pypi.org/project/local-ai-agent-orchestrator/
- https://github.com/KEYHAN-A/local-ai-agent-orchestrator

**Transferable:** structured plans, mechanical verification, reviewer separation, resumable state and Git traceability.

**Failure to invert:** don't grant a coding agent broad access to production secrets or unrestricted shell execution. Use a disposable least-privilege workspace; inspect dependencies and license obligations before incorporating or redistributing code. Adopt workflow concepts before embedding the framework unless a license/security review approves it.

### PolyCouncil: multi-model critique exists, but check commercial licensing

The public repository describes parallel model answers, peer scoring, deliberation/discussion modes, provider integrations and tests. Its README states Polyform Noncommercial License 1.0.0:
- https://github.com/TrentPierce/PolyCouncil

**Transferable:** independent answers, rubric-based evaluation, recorded dissent and reproducible comparison.

**Failure to invert:** don't embed or redistribute noncommercial-licensed code in a commercial product without confirming rights. Implement the general technique independently or obtain permission. Multiple models can share blind spots; consensus is not ground truth.

### Agent Company AI: promising integration surface, but verify before granting authority

The repository advertises role-based agents, tool integrations, Stripe/Gumroad/invoicing, cost caps and autonomous cycles:
- https://github.com/gobeyondfj-cmd/agent-company-ai

These are project claims, not independent proof of reliable external revenue or safe autonomous operation.

**Transferable:** roles, explicit budgets, workflow state, cost telemetry and tool boundaries.

**Failure to invert:** don't connect live payment credentials, email, shell or production deployments until code, permissions, webhook handling, spending caps and rollback behavior are reviewed. A dashboard's revenue ledger is not authoritative settlement evidence.

### Gauntlet Loop: useful bounded build/critique pattern, not a quality guarantee

Public implementations describe reference-led, multi-agent build-and-critique loops:
- https://github.com/duolahypercho/gauntlet-loop
- https://github.com/kamtS/gauntlet-loop

Repository names and maintainers differ from the draft's claimed Nice6042 source; verify the intended canonical project before installation.

**Transferable:** define a concrete acceptance bar, use a fresh critic, inspect the actual artifact, bound iterations, preserve failures and stop/escalate unresolved defects.

**Failure to invert:** don't require literal indistinguishability from a competitor's protected product. Use reference behavior and customer outcomes as benchmarks, while producing original code, UI, content and design. Pair LLM critique with tests, measurements, security scans and human approval for irreversible actions.

### LM Studio llmster: real headless option, but host uptime and security remain dependencies

LM Studio documents llmster as a headless daemon; it can be started with lms daemon up, while the API server is managed separately:
- https://lmstudio.ai/docs/developer/core/headless
- https://lmstudio.ai/docs

**Transferable:** local inference can reduce per-call hosted inference spend and keep selected data local.

**Failure to invert:** don't assume the model server is available because the daemon started. Verify model load, API server status, authentication, host sleep, network reachability and resource usage. Never expose an unauthenticated local inference server to the public internet. A sleeping or powered-off PC is not a production SLA.

## Financial projections in the draft

The proposed $49 first sale, $2,000/month and $10,000/month phases are targets, not evidence-backed forecasts. The 20–30% competitor-price rule, five products in 30 days, 20% kill rate, and 30/60/90-day gates are hypotheses, not universal laws.

Replace them with experiment-specific stop/go gates based on qualified demand, conversion, actual fulfillment, gross margin, acquisition cost, support burden, repeat use and cash runway. Avoid arbitrary product quotas. Do not scale paid acquisition or add recurring commitments while there is no spare capital.

## DreamLedger execution protocol

For each reference product, create a Pattern Card:
- pattern_id, source URL, date checked, evidence grade
- buyer and job-to-be-done
- proven mechanism vs reported claim vs forecast
- pricing, cost drivers, acquisition channel and fulfillment burden
- failure modes, legal/license constraints and external dependencies
- original implementation plan and differentiator
- acceptance tests and counterexamples
- experiment budget (default NZ$0 upfront), kill criteria and next decision
- external settlement, delivery and evidence status

Use separate agents: Scout (primary sources and buyer intent); Abstractor (mechanisms and failure modes); Builder (original components); License/Security Critic (provenance, dependencies, permissions and threat model); Blind Product Critic (outcome rubric); Gauntlet (automated/adversarial tests); Publisher (passing components only); Truth Oracle (independent settlement and delivery reconciliation).

Do not allow the same agent to both assert a claim and certify its own claim. Record dissent and unknowns.

## First-dollar rule

The existing TOLL-PROBE-50C remains the first-dollar experiment until its current checkout, settlement webhook, scoped entitlement, successful probe and receipt are revalidated. Do not launch more SKUs just because the factory can generate them. If the current path is blocked by the database outage, explicitly mark dependent behavior unverified and identify the smallest safe fix; don't replace durable controls with in-memory state and call it production-ready.

## Scoreboard

Verified external revenue remains **NZ$0.00** until an independent buyer pays, the payment is attributable and settled, the promised result is delivered, and evidence reconciles. Case-study revenue, checkout starts, agent outputs and internal transactions are not DreamLedger revenue.