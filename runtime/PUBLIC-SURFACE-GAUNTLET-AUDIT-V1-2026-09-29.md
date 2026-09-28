# PUBLIC SURFACE GAUNTLET AUDIT V1

Date: 2026-09-29
Target: public/index.html

## Decision

Internal control-plane language must not be presented as the public product proposition.

Keep internal:
CUBE, SWARM, Elohim, Gauntlet, Digital Proxy, Truth Oracle, Creatorizer, Sympathizer, Humanizer, Monetizer, Auditor and internal authority ladders.

Public users need the outcome and product language:
discover, buy, sell, commission, learn, trade, create an account, manage offers, request work, track orders and see verified commerce.

## Current public-surface findings

The homepage currently exposes:
- “CUBE · live silos”
- “The CUBE surface is a live catalogue of public silos.”
- “CUBE” labels and route IDs
- “Evidence-led commerce”
- “Settlement-backed commerce”
- internal-sounding “economic record” language

These are implementation concepts rather than the clearest public product language.

The homepage also still contains an MTG rail, but MTG is explicitly framed as one specialist offer among many. This is not an architectural violation.

## Required public rewrite

Replace CUBE-facing copy with user-facing category language such as:
“Explore worlds”
“Browse categories and specialist markets”
“Find products, services, commissions and opportunities across DreamLedger.”

Replace internal trust wording with plain customer language:
“Clear offers”
“Transparent pricing”
“Secure checkout”
“Order records”
“Verified transaction history”

Do not expose internal orchestration names, internal economic state, control-plane terminology, model roles, evidence pipeline terminology or authority ladders.

## Public product doctrine

DreamLedger is the front door.

It should communicate:
1. Create an identity.
2. Discover things worth buying, selling or commissioning.
3. Explore specialist worlds without needing to understand their internal machinery.
4. Publish or manage offers.
5. Complete legitimate transactions.
6. Keep useful records of those transactions.

The website should sell the destination, not explain the engine.

## Gauntlet rule

Any internal term appearing in public HTML, metadata, visible navigation, visible headings, visible body copy or customer-facing error states must pass a public-language gate.

Internal architecture belongs in internal documentation and operator surfaces.

## Next implementation

The public homepage should be rewritten to remove internal architecture language while retaining the actual product capabilities and routes.

The implementation should not remove functioning marketplace, account, catalogue or silo routes. It should change the presentation layer only unless a route itself exposes internal terminology.
