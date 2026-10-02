# Agent Bridge Scaffold Mine - 2026-10-03

Status: RESEARCHED_AND_MAPPED
Economic scoreboard remains unchanged:
VERIFIED_EXTERNAL_REVENUE_NZD=0
SETTLED_EXTERNAL_PAYMENTS=0
INDEPENDENT_EXTERNAL_BUYERS=0
VERIFIED_ECONOMIC_OUTCOMES=0

## Decision

Do not build a second commerce engine. DreamLedger already contains the toll-road substrate:
- supabase/functions/agent-toll-road
- supabase/functions/x402-reconcile
- supabase/migrations/20260929055000_agent_toll_quote_compare.sql
- supabase/migrations/20260929_x402_replay_guard.sql
- public/agent-bridge.html
- public/bridge-tolls.json
- public/agent-commerce.json
- public/.well-known/agent-commerce.json
- public/quote-comparison/*
- runtime/toll-road/*
- runtime/economic/*
- docs/AGENTBRIDGE-ECONOMIC-HIGHWAY-1.2.md
- RIVET/marketplace.html
- marketplace/index.html

The external repository mine is an acceleration layer, not a replacement architecture.

## External scaffold candidates

### 1. codespar/x402-monetization-examples
URL: https://github.com/codespar/x402-monetization-examples
License observed in README: MIT.
Reuse: seller-side x402 paywalls, API/MCP/payment-link examples, governed spending and receipt patterns.
Primary lane: TRANSACTION / PAYMENT / MCP.

### 2. cloudflare/agents
URL: https://github.com/cloudflare/agents
Reuse: durable agent execution, MCP, workflows, sandboxed execution, x402 integration, idle/hibernate patterns.
Primary lane: AGENT EXECUTION / SANDBOX / FALLBACK.
Use only if a measured failure justifies the dependency.

### 3. merkleworks/x402-mcp
URL: https://github.com/merkleworks/x402-mcp
Reuse: paid HTTP discovery, 402 handling, MCP wrapper, discovery manifest.
Caution: README describes a BSV-flavoured implementation. Treat as MCP scaffolding, not a drop-in payment rail.
Primary lane: MCP CLIENT / DISCOVERY.

### 4. x402cloud/x402cloud
URL: https://github.com/x402cloud/x402cloud
License observed in README: MIT.
Reuse: protocol/client/middleware separation, usage metering, discovery manifests, facilitator separation.
Primary lane: PAYMENT MIDDLEWARE / METERING / DISCOVERY.
DreamLedger already has server-side x402 code, so compare before importing.

### 5. faremeter/marketplace
URL: https://github.com/faremeter/marketplace
Reuse: marketplace/service discovery, x402 payment rails, local test stack patterns.
Primary lane: MARKETPLACE / DISCOVERY / PAYMENT.

### 6. the402ai/mcp-server
URL: https://github.com/the402ai/mcp-server
Reuse: service catalog, fixed-price service purchase, digital products, provider services, subscriptions, earnings/referrals.
Primary lane: AGENT MARKETPLACE.
Do not adopt its account/balance model as DreamLedger truth.

### 7. antonyharo/agent-economy-e2e
URL: https://github.com/antonyharo/agent-economy-e2e
Reuse: local E2E commerce sandbox, cart/checkout/payment/confirmation contracts, idempotency, MCP commerce boundaries.
Primary lane: SANDBOX / E2E TESTING.
Simulated money never enters DreamLedger truth.

### 8. sean-roth/ucp-sandbox
URL: https://github.com/sean-roth/ucp-sandbox
Reuse: UCP discovery, checkout, AP2/A2A/MCP integration references, chaos-testing methodology.
Primary lane: AGENTIC COMMERCE / CHAOS TESTING.
Reference implementation only.

## Existing DreamLedger scaffolding already found

Toll/payment:
- agent-toll-road Edge Function
- x402 reconciliation Edge Function
- x402 replay guard
- quote-comparison toll product registry
- settlement/proof/economic-event path

Trust/proof:
- Truth Oracle
- proof.schema.json
- runtime_proofs
- production observation contract
- deterministic event projection
- state transition engine
- Stripe observation adapter
- Gauntlet readiness

Marketplace:
- RIVET B2B marketplace
- public marketplace
- CUBE marketplace API
- quote comparison pages
- quote intake/fulfillment
- seller onboarding and Stripe Connect webhooks

Agent bridge:
- AGENT_BUS/BRIDGE
- bridge protocol
- public agent manifests
- agent-bridge.html
- bridge toll manifest
- AgentBridge economic highway

Economic substrate:
- economic state machine
- economic event migrations
- fulfillment worker
- substrate admission/survival gates
- opportunistic GPU workflow
- LM Studio economic swarm controller
- cloud fallback economic watch
- first-dollar frontier and hands-off catalyst proofs

## Economic surface matrix

| Surface | Existing substrate | External scaffold | First test |
|---|---|---|---|
| Trust / verification | Truth Oracle + proof schemas | x402cloud discovery/probes | paid verification call |
| Transaction | agent-toll-road + x402 reconcile | CodeSpar examples | settled paid call |
| Marketplace | RIVET + public marketplace | the402/faremeter patterns | service discovery |
| Agent security | authority evidence + bridge gates | Cloudflare workflows/sandbox | authorization rehearsal |
| Quote arbitrage | quote intake/compare/fulfillment | procurement/RFQ repos | paid quote comparison |
| Digital artifacts | public artifact/avatar surfaces | agent marketplace patterns | paid digital artifact |
| Identity | agent manifests + avatar surfaces | MCP marketplace identity patterns | paid identity/attestation |
| Proof | runtime_proofs + Truth Oracle | x402 receipt patterns | paid proof artifact |

## Important finding

The repository is materially farther along than the external thesis assumes.

The immediate gap is not "build API monetization."

The immediate gap is "get one independent external buyer to cross the already-live toll boundary and observe settlement independently."

Existing 2026-10-03 proof artifacts record a live public toll surface, live checkout routes, settlement-before-key guardrails, and a zero verified economic scoreboard.

Therefore no new payment architecture should be created before the first external economic event unless a measured production blocker proves it necessary.

## Repurposing rule

External code is classified:
REUSE_DIRECTLY
ADAPT
REFERENCE_ONLY
REJECT

No external repository is authoritative for DreamLedger economic truth.

No simulated payment, testnet settlement, sandbox buyer, internal agent, checkout creation, generated receipt, or internal row can advance verified revenue.

## Next machine frontier

1. Verify live production toll manifest and checkout routes.
2. Verify the paid quote-comparison route can complete fulfillment without owner work.
3. Verify production settlement reconciliation.
4. Identify the smallest lawful external buyer action that can occur without owner fulfilment.
5. Keep outreach/public posting behind the existing human gate.
6. After one real payment, replicate the winning toll primitive sideways.

## Amber-room definition

AMBER_ROOM = a live, externally reachable, machine-fulfilled paid capability with:
- discoverable contract
- explicit price
- authorization boundary
- settlement proof
- idempotent fulfillment
- delivery artifact
- independent verification
- zero owner fulfilment minutes after authorization

Amber-room is NOT:
- code complete
- checkout created
- internally generated API key
- testnet transaction
- simulated buyer
- internal agent call
- CI green
- database row

It is the first externally paid, independently evidenced, machine-fulfilled event.

Generated: 2026-10-03
