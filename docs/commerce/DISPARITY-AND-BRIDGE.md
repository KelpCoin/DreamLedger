# DreamLedger Disparity -> Bridge Plan

Date: 2026-09-27

This is the control document for closing the capability gap. A capability counts only when implemented, tested, observable, and connected to real state.

## 1. Commerce

Disparity:
DreamLedger has a storefront prototype and database direction. Shopify provides a mature merchant commerce stack.

Bridge:
1. Persist catalog in Supabase.
2. Add variants, inventory, pricing and product status.
3. Add cart persistence.
4. Wire Stripe Checkout.
5. Verify Stripe webhooks cryptographically.
6. Create idempotent orders only from verified payment events.
7. Add receipts.
8. Add refunds and cancellation state.
9. Add fulfillment.
10. Add customer accounts.
11. Add taxes/shipping abstractions.
12. Add discounts.
13. Add analytics.
14. Add merchant settings.

Exit test:
A real test purchase can move from catalog to payment to verified order to fulfillment to receipt without manual database mutation.

## 2. Operational ontology

Disparity:
Palantir's Ontology represents real-world objects, links and actions, and connects data, logic and action into operational decisions. DreamLedger currently has fragmented domain tables and agents.

Bridge:
Create canonical object types:
Store, Product, Variant, Customer, Order, Payment, Fulfillment, Evidence, DemandSignal, Opportunity, Decision, Action, ExternalEffect, Outcome, Agent, Policy.

Create canonical links:
CUSTOMER_PLACED_ORDER, ORDER_CONTAINS_PRODUCT, ORDER_PAID_BY_PAYMENT, ORDER_FULFILLED_BY_FULFILLMENT, ACTION_TARGETS_OBJECT, ACTION_PRODUCED_EFFECT, EFFECT_OBSERVED_AS_OUTCOME, EVIDENCE_SUPPORTS_OBJECT.

Create first-class actions:
CreateOrder, CapturePayment, RefundOrder, FulfillOrder, PublishOffer, SendForApproval, ExecuteExternalAction, ReconcilePayment, RecordOutcome.

Exit test:
A decision can be traced from source facts through policy and action to an observed external outcome.

## 3. Orchestration

Disparity:
UiPath provides durable orchestration across agents, people, APIs and robots, with pause/resume, governance and observability. DreamLedger has loops and Edge Functions but not yet one durable process runtime.

Bridge:
Create an explicit workflow runtime:
workflow -> run -> step -> lease -> attempt -> result -> checkpoint -> resume.

Required states:
QUEUED, RUNNING, WAITING_APPROVAL, WAITING_EXTERNAL, RETRYING, SUCCEEDED, FAILED, CANCELLED.

Required controls:
timeouts, retries, idempotency keys, dead-letter handling, compensation actions, human gates, audit events.

Exit test:
A workflow can fail halfway through, resume from a checkpoint, and never duplicate an external side effect.

## 4. Integration fabric

Disparity:
Enterprise platforms connect heterogeneous systems. DreamLedger currently has a small number of integrations.

Bridge:
Create connector contracts for:
HTTP API, Stripe, Supabase, email, storage, MCP, browser/UI automation where permitted, and future ERP/CRM systems.

Every connector must expose:
authenticate, discover, read, write, observe, health, rate-limit, retry.

Exit test:
A workflow can call two independent external systems through the same governed connector interface.

## 5. Agent control plane

Disparity:
A model endpoint is not an enterprise agent platform.

Bridge:
Create:
agent registry, versioning, capabilities, tool permissions, model routing, context policy, budgets, execution limits, pause/rollback, evaluations and traces.

Agent lifecycle:
DRAFT -> TEST -> APPROVED -> ACTIVE -> PAUSED -> RETIRED.

Exit test:
Every agent action is attributable to a specific agent version, policy version and execution.

## 6. Evidence and truth

Disparity:
DreamLedger has a strong truth doctrine, but it needs to become a platform primitive.

Bridge:
Every economically consequential object gets an evidence chain:
claim -> source -> observation -> hash -> timestamp -> evaluator -> verdict.

Verdicts:
VERIFIED, UNVERIFIED, CONTRADICTED, STALE, TEST, SIMULATED, INTERNAL, UNMATCHED.

Exit test:
The system can explain exactly why an economic outcome is or is not counted.

## 7. Security and governance

Disparity:
Enterprise platforms enforce identity, permissions, tenant isolation and audit controls throughout execution.

Bridge:
Implement:
tenant isolation, RBAC, service identities, secret boundaries, row-level security, action policies, approval policies, immutable audit events, webhook verification, rate limits and emergency kill switches.

Exit test:
A user or agent cannot execute an action outside its assigned tenant, role, policy or capability.

## 8. Developer platform

Disparity:
Large platforms expose their capabilities to developers rather than trapping them inside one UI.

Bridge:
Build:
REST API, OpenAPI schema, MCP server, API keys, OAuth/service identities, webhooks, SDK primitives, event subscriptions and developer documentation.

Exit test:
An external program can discover a product, request a checkout, inspect order state and retrieve a machine-readable evidence result through supported interfaces.

## 9. Analytics and decision intelligence

Disparity:
DreamLedger records activity but needs operational analytics over the canonical object model.

Bridge:
Build metrics for:
conversion, settlement, fulfillment time, refund rate, repeat purchase, customer lifetime value, demand velocity, opportunity quality, workflow success, external-effect latency and verified economic outcomes.

Every metric must have:
definition, source tables, time window, freshness, calculation and truth status.

Exit test:
Every displayed economic metric can be traced back to underlying records.

## 10. Marketplace and ecosystem

Disparity:
Shopify and enterprise platforms become more powerful through integrations and third parties.

Bridge:
Create an integration/app model:
app -> permissions -> connector -> events -> actions -> evidence.

Later:
app registry, install flow, scoped credentials, billing, versioning and approval.

Exit test:
A third-party integration can be installed without granting unrelated access.

## 11. Physical-world execution

Disparity:
Palantir and UiPath can connect digital decisions to systems and operational processes. DreamLedger is currently mostly digital.

Bridge:
Prioritize APIs first, then controlled browser/UI automation where APIs do not exist.

Every physical-world or irreversible action requires:
authority + policy + idempotency + evidence + human gate where configured.

Exit test:
The platform can prove what external system changed, when, why and under whose authority.

## 12. The convergence architecture

Target:

WORLD
  |
SIGNALS
  |
OBJECT GRAPH
  |
DECISION / LOGIC
  |
POLICY
  |
ACTION
  |
ORCHESTRATION
  |
CONNECTORS
  |
EXTERNAL SYSTEM
  |
OBSERVATION
  |
EVIDENCE
  |
OUTCOME
  |
LEARNING
  |
WORLD

Commerce becomes one major workload running on this substrate, rather than the entire product.

## Priority order

P0: real payment/order/fulfillment loop
P0: canonical object/evidence model
P0: durable action state machine
P0: security/RLS/identity
P1: connector fabric
P1: agent control plane
P1: merchant analytics
P1: MCP developer platform
P2: integrations marketplace
P2: advanced browser/physical-world automation
P2: multi-region and enterprise scale

## Non-negotiable

No parity claim is made from UI resemblance.

A capability is complete only when:
implemented + tested + observable + governed + connected to real state.

Architecture work that does not move one of those five properties forward is backlog, not progress.
