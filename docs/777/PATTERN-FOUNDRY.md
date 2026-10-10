# Pattern Foundry: lawful replication at 777 scale

**Status:** BUILD SPECIFICATION · not a claim of deployed functionality or revenue  
**Commercial principle:** reproduce proven *jobs-to-be-done* and product mechanics, not protected brand identity, proprietary code, confidential designs, or counterfeit goods.

## Objective

Build a low-cost factory that discovers a proven product pattern, decomposes it into reusable components, generates an original implementation, tests it with adversarial agents, publishes only the passing artifact, and measures real demand and delivery.

## The factory loop

1. **Scout** — identify a repeated customer job from public sources, open standards, public product docs, reviews, and observed search demand. Record source, date, license/usage constraints, buyer, incumbent friction, and confidence.
2. **Abstract** — extract the generic pattern: job, input/output, workflow, UX conventions, pricing logic, integrations, failure modes. Exclude names, logos, distinctive visual identity, proprietary assets, and copied text/code.
3. **Stencil** — convert the pattern into a reusable schema, page template, API contract, test fixture, word bank, component library, or workflow.
4. **Generate** — candidate LLM creates an original minimal version. Local GPU is preferred when available and adequate; cloud models are optional, budget-capped, and never assumed free.
5. **Cross-review** — separate agents perform product, implementation, security/privacy, accessibility, IP/trademark, factuality, and unit-economics reviews. Reviewers must cite testable failures, not simply vote.
6. **Gauntlet** — automated tests, secret scan, dependency/license checks, build check, accessibility check, source/provenance check, abuse-case tests, and explicit truth labels. Unknown is not pass.
7. **Publish** — create a pull request or publish an isolated public artifact with version, changelog, sources, limits, and one clear CTA. Do not auto-publish bulk thin pages.
8. **Measure** — record qualified demand, activation, independent settled buyers, successful delivery, refunds/disputes, compute cost, gross contribution, repeat use, and human minutes. Never count tests, self-purchases, checkout starts, or unmatched payments as revenue.
9. **Refine or retire** — keep variants that beat a baseline on measured value; archive failures and retain their lessons.

## First commercial wedge

Start with a **$0 discovery / low-cost execution** Agent Bridge:
- Free B2B capability directory and public machine-readable manifests.
- A2A calls priced per bounded operation, with clear limits and no surprise recurring billing.
- First toll-road experiment remains the existing TOLL-PROBE-50C route; inspect and repair that path before launching new SKUs.
- Every paid call must reconcile: independent buyer → settled payment → correct SKU/amount/currency → scoped entitlement → successful result → receipt.
- If the existing Supabase dependency is unavailable, mark durable entitlement/atomic quota enforcement UNVERIFIED. Do not pretend an in-memory workaround is enterprise-grade.

## Huge workstreams, chopped into small tickets

### A. Open capability exchange
Discovery index → provider schema → offer comparison → RFQ handoff → trust/provenance → paid execution → reviews tied to fulfilled transactions → dispute/refund state.

### B. Reusable digital-goods foundry
Original templates, stencils, word banks, boilerplates, data schemas, component kits, and vertical-specific workflow packs. Each asset needs license, version, sample output, compatibility, tests, and an explicit commercial license.

### C. Commerce interoperability
Product/offer feeds, merchant import adapters, price/availability timestamps, attribution, checkout handoff, order status, fulfillment evidence, refund handling. Start with opt-in adapters and open standards; never scrape behind access controls or bypass platform terms.

### D. Programmatic DOOH and billboards
Inventory schema, location/time slot, verified owner authorization, creative dimensions, availability, proof-of-play evidence, campaign budget, and reconciliation. Begin as a software registry and planning tool; do not claim access to physical screens without signed inventory authorization.

### E. Opt-in GPU capability
Publish hardware/model/runtime capabilities and an explicit availability schedule. Do not expose the home machine or open arbitrary remote code execution. Later design requires authenticated jobs, container isolation, quotas, budget ceilings, network egress controls, secret isolation, logs, cancellation, and kill switch. No public GPU rental until threat model and sandbox tests pass.

### F. Domain vertical packs
Aerospace provenance, carbon-forward preparation, cold-chain evidence, and customs discrepancy review are research candidates, not validated buyers. Build source-linked schemas and synthetic fixtures first. Regulated decisions remain human-reviewed; never claim certification or guaranteed recovery.

## Non-negotiable gates

- Source and license provenance attached to every generated artifact.
- No trademarks, logos, copied product art, proprietary code, or misleading affiliation.
- No unverified factual claims published as facts.
- No autonomous spending, account creation, public transmission, or irreversible actions without the relevant authorization.
- No production secrets in prompts, logs, public artifacts, or model context.
- No scaling page count until unique utility, source quality, indexation, and conversion justify it.
- No scaling compute until contribution margin and isolation are measured.
- One experiment per cycle; each cycle returns a durable artifact or a falsifiable failure report.

## Scoreboard

Current verified external revenue: **NZ$0.00** until reconciled evidence proves otherwise.  
Primary KPI: **independent settled buyers who receive the promised result**.  
Supporting KPIs: qualified demand, checkout-to-settlement rate, settlement-to-entitlement match, successful delivery rate, contribution margin after model/compute/fees, refund/dispute rate, repeat use, p95 latency, and human minutes per verified outcome.

## First implementation sequence

1. Inspect current Agent Bridge manifest, checkout URL, deployed handler, Stripe webhook, entitlement logic, scoped credential, probe and receipt.
2. Fix the first broken boundary and add regression tests.
3. Run unpaid, mismatched SKU/amount/currency, duplicate webhook, retry, expired entitlement, refund/revocation, quota race, and successful delivery tests.
4. Publish the smallest original stencil that demonstrably works.
5. Capture one independent buyer and end-to-end delivery before expanding.
6. Use each verified cycle to open small issues for the next component; do not generate a giant unreviewed code dump.
