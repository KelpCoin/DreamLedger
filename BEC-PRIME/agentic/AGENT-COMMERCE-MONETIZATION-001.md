# AGENT COMMERCE MONETIZATION 001

Status: EXECUTION MODE
Date: 2026-08-19

## Objective
Make DreamLedger a useful home for agentic commerce without attempting to become a competing global payment protocol.

## Wedge
DreamLedger owns the merchant-side verification and commercial proof layer.

The free surface is an agent-readable directory of offers and capabilities.
The paid surface is verification and implementation work for businesses that want their offers to be discoverable and purchasable by agents.

## Revenue ladder

1. Free: machine-readable listing and public agent-commerce directory.
2. NZ$99: Agent Commerce Verified Listing. Audit catalog, pricing, policy, fulfillment, machine-readable metadata and checkout readiness; publish a verified listing after evidence checks.
3. NZ$249: Agent Commerce Launch Pack. Implement the missing machine-readable surfaces and verification checks.
4. NZ$499+: Agent Commerce Control Plane. Custom integration, monitoring, settlement evidence and protocol adapters.
5. Transaction layer: only charge a percentage or fixed routing fee when DreamLedger actually controls a transaction path. Do not invent a take-rate before transaction volume exists.

## Competitive rule
Do not copy a pixel canvas. The defensible wedge is useful commerce state: offer identity, capability discovery, readiness, verification, checkout state, settlement evidence and post-purchase proof.

## Protocol strategy
Track and interoperate with UCP, ACP, AP2, MCP and A2A. Do not attempt to replace them. UCP explicitly supports discovery, negotiation, checkout and handoff; DreamLedger should sit beside these protocols as a verification, routing and proof layer. See public references in the project research log.

## Immediate experiment
Goal: one paying agent-commerce customer before expanding the platform.

Acceptance criteria:
- A public machine-readable agent-commerce page exists.
- One paid offer is explicitly approved before publication.
- Checkout is server-authoritative.
- A real payment creates a durable proof event.
- No claim of revenue is made before the webhook evidence exists.

## Anti-trench rule
No new protocol, multi-agent, dashboard, token, database or UI work unless it directly improves discovery, conversion, payment, fulfillment or proof for this experiment.

## Existing assets
- BEC-PRIME/compiled/website/agentic-commerce/index.html
- BEC-PRIME/compiled/website/.well-known/agent-commerce.json
- BEC-PRIME/scripts/verify-agentic-commerce.js
- BEC-PRIME/catalog/offers.json
- BEC-PRIME/README-IP-AND-MONEY.md

## 60-second verification
Search the repository for AGENT-COMMERCE-MONETIZATION-001 and verify the existing agentic-commerce surface, machine-readable manifest, verification script and catalog are present. Then verify production independently. A repository artifact is not production proof.
