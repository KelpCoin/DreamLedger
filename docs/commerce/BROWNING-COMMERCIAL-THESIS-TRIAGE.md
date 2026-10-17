# Browning Commercial Thesis Triage v1

Status: proposed decision contract, not a launch authorization
Date: 2026-10-18
Scope: DreamLedger / BrownEye Cortex commercial experiments

## Decision

Do not turn every thesis into a product or a silo. Run one low-cost, evidence-gated commercial experiment at a time, using the existing substrate. Do not treat the Commander Deck Diagnostic as the default offer; prior user feedback explicitly rejects it as an acceptable flagship.

The next offer must be selected by demonstrated customer pain, feasible fulfillment, and measurable willingness to pay. The existing Truth Oracle / evidence-backed decision-report direction is a candidate to validate, not a proven winner. No claim of demand or profitability is made until an independent buyer pays and receives the promised value.

## Portfolio triage

| Thesis | Decision | Why / gate |
|---|---|---|
| Browning Method multi-model refinement | BUILD as an internal quality method first | Useful only when it reduces defects or delivery time on an actual artifact. Scores do not prove readiness or market value. |
| BEC Truth / evidence-backed decision report | VALIDATE as the leading existing-offer candidate | Define one buyer, one expensive decision, source-backed evidence, a concrete deliverable, and an honest price. Test demand before expanding features. |
| Forge / Cockatrice / MTG analytics | HOLD as a separate candidate | Requires a real differentiator, lawful data sourcing, reproducible simulation, clear output, and proof customers will pay. Do not use the rejected Commander Diagnostic as a proxy for demand. |
| Astrology personalization | HOLD | Can be entertainment, not a scientifically validated prediction service. Protect birth data, avoid manipulative retention, and test demand before building subscriptions. |
| Swarm scraping / social posting | REJECT spam tactics; allow compliant research only | No mass unsolicited replies, fake accounts, platform evasion, or deceptive traffic. Use public APIs/permissions, rate limits, terms-compliant research, and opt-in/inbound distribution. |
| E-commerce conversion tactics | ACCEPT ethical subset only | Accurate descriptions, real inventory, authentic reviews, transparent total costs, accessible checkout, and relevant optional recommendations. Reject hidden fees, fabricated reviews, and coercive pop-ups. |
| Resilience / progressive transparency SaaS | HOLD pending buyer evidence | Reliability is valuable only with a specific buyer, measurable recovery objectives, tested failover, and a supportable service promise. Never guarantee uptime or integrity without proof. |
| $1 pixel / micro-purchase engine | HOLD | Low price does not create distribution or demand. Require a clear customer benefit, fees-aware unit economics, and a credible acquisition channel before implementation. |

The market-size, margin, revenue, conversion, and named-tool claims in the supplied thesis are unverified inputs. They must not be copied into public marketing or used as financial forecasts until independently sourced and checked for date, geography, definition, and methodology.

## Browning commercial loop

1. **Find a costly, specific problem.** State the buyer, trigger, current workaround, consequence, and what a successful result looks like. If these are unknown, mark them UNKNOWN.
2. **Choose one existing offer candidate.** Reuse current repository, checkout, ledger, fulfillment, and evidence infrastructure. No parallel ledger, queue, or new silo for an unvalidated idea.
3. **Create the smallest useful free proof.** It must deliver genuine value, not just collect contact details. Keep the scope and limitations explicit.
4. **Offer one paid next step.** Specify price, exact deliverable, turnaround, exclusions, refund/support terms, and how delivery is verified. Show the full price before payment.
5. **Validate demand without deception.** Use accessible inbound discovery, search content, permitted communities, and opt-in channels. Do not fabricate reviews, buyers, urgency, scarcity, or endorsements.
6. **Fulfill manually if needed.** A reliable manual service is preferable to automating a product nobody buys. Do not automate payment grants until settlement and idempotency are verified.
7. **Record the evidence.** Separate impressions, visits, CTA clicks, checkout starts, failed payments, settled payments, fulfillment, delivery, refunds, and repeat purchases.
8. **Decide using thresholds set before the test.** Continue, revise, or stop based on observed results, costs, and customer feedback. Do not move thresholds after seeing the outcome to manufacture a pass.
9. **Apply the Pillarstone loop to the artifact.** Build, atomize, independently challenge, salvage/rebuild, test, score with cited evidence, and record unresolved risks.
10. **Scale only after the full loop works.** One successful transaction is a signal, not proof of repeatable product-market fit. Replication requires evidence that fulfillment, support, costs, and acquisition remain viable.

## Commercial readiness gates

A candidate cannot pass merely because code or CI is green.

- **Problem evidence:** a named customer segment and a specific job-to-be-done; demand evidence is attributable and not fabricated.
- **Offer clarity:** buyer understands deliverable, limits, price, and terms before checkout.
- **Unit economics:** payment fees, compute, data, fulfillment time, refunds, support, tax obligations, and acquisition costs are estimated and then replaced with observed values.
- **Payment truth:** live payment is independently settled, correctly attributed to the canonical offer and order, and idempotently recorded.
- **Delivery truth:** the correct customer receives the promised artifact or service; a retrievable delivery record exists.
- **Reconciliation:** Stripe, order, fulfillment, evidence, and ledger records agree; refunds and failures are represented honestly.
- **Safety and privacy:** least privilege, data minimization, retention rules, consent where required, and no secrets in prompts/logs.
- **Operational approval:** production routing, secrets, public checkout, spending, or deployment changes use existing explicit approval gates.

## Revenue definition

Verified revenue remains NZ$0.00 until an independent external buyer's payment is settled, attributed to the correct offer, fulfilled, delivered with retrievable proof, and reconciled in the canonical ledger. Gross receipts are not profit. A successful test, checkout session, active link, model score, traffic spike, or deployment is not revenue.

## First experiment worksheet

- Candidate offer: UNKNOWN until the buyer/problem and existing implementation are reviewed.
- Target buyer and urgent problem: UNKNOWN.
- Free proof / paid deliverable: UNKNOWN.
- Price and delivery cost: UNKNOWN.
- Existing canonical checkout and fulfillment route: MUST BE VERIFIED.
- Acquisition channel: accessible, inbound, permission-based; no paid spend without approval.
- Success / stop thresholds: set before launch.
- Evidence location and owner: existing canonical ledger and evidence-artifact path; verify actual names before wiring.
- Launch status: HOLD until the above are specified and existing production blockers are repaired.

## Immediate sequence

1. Review the existing Truth Oracle / evidence-backed decision-report implementation and its real customer outcome. Do not assume it is ready or demanded.
2. Repair and test the canonical payment-to-delivery substrate without changing live webhook routing or secrets absent explicit approval.
3. Write one offer specification and acceptance test for the strongest existing candidate.
4. Run a no-spend, accessible demand test before expanding code or spinning up more silos.
5. After authorization, run one controlled real transaction, then verify settlement → order → fulfillment → retrievable delivery → ledger reconciliation.
6. Only then decide whether to repeat, revise, or stop.

This document is a triage proposal. It does not authorize public launch, live payment changes, customer contact, spending, deployment, or claims of profitability.
