# DREAMLEDGER GAME INTEGRATION BOUNDARY
Date: 2026-10-02
Status: CANONICAL ARCHITECTURE BOUNDARY

## Purpose

Define what MMO/game information belongs on the existing DreamLedger substrate and what must remain game-domain state.

## Principle

The MMO is a domain/silo and potential commercial OFFER. It is not a replacement for the DreamLedger economic truth system.

777 remains the demand-generation multiplication operator.

## Storage split

### Game-authoritative state

Persistent game state may live in the existing Supabase/PostgreSQL substrate where the current schema and security model support it.

Candidate entities:
- players / characters
- character progression
- floor clears
- bosses
- titles
- soul records
- guilds
- guild membership
- territories
- territory ownership
- territory history
- settlements
- structures
- world events
- wars
- alliances
- resources
- inventory
- cosmetics / entitlements
- matchmaking state
- leagues
- audit/history records

These are game-domain records.

### Economic truth

Do not duplicate the economic ledger inside the game silo.

Use the existing DreamLedger economic truth boundary for:
- external buyer identity where lawfully available
- authorization
- payment evidence
- settled payment
- fulfillment
- delivery/evidence
- verified economic outcomes

A game purchase or cosmetic entitlement may reference economic evidence, but it does not redefine what counts as revenue.

## Territory and guild persistence

Guild wars, territory, settlements and world changes should be represented as auditable transitions.

Prefer:
EVENT → VALIDATED TRANSITION → CURRENT STATE

over:
CURRENT STATE ONLY

This allows reconstruction of why a territory changed without treating arbitrary database state as historical truth.

Candidate history fields:
- event_id
- occurred_at
- actor
- guild_id
- territory_id
- previous_state
- new_state
- cause
- evidence_ref
- authorization_scope
- server/world_id

The exact schema must reuse existing DreamLedger/Supabase structures where possible.

## Cosmetic entitlements

A cosmetic SKU is an entitlement identifier, not proof of payment by itself.

Potential chain:

EXTERNAL PURCHASE
→ SETTLED PAYMENT
→ VERIFIED ECONOMIC OUTCOME
→ ENTITLEMENT
→ GAME INVENTORY
→ EQUIPPED COSMETIC

The client must never create entitlement merely because it displays a SKU.

## Identity

Game identity and DreamLedger account identity may be linked only through an explicit authenticated relationship.

Do not use client-provided metadata as authorization.

Server-side ownership and authorization remain authoritative.

## 777 boundary

777 may test:
- MMO offer propositions.
- Game concepts.
- Community propositions.
- Guild/territory propositions.
- Free trials.
- Waitlists.
- Play tests.
- Community events.

A cell is still:

OFFER × AUDIENCE × MESSAGE × SURFACE × CTA

The marketplace is one possible surface, not the purpose.

## Development boundary

Do not build:
- a second economic ledger
- a second payment truth system
- a second authorization framework
- a second marketplace ledger
- a separate avatar ownership truth source
- a second swarm/orchestration system

Reuse existing infrastructure.

## Current implementation status

Repository documentation is the first persistence layer for this design.

Supabase production inspection was attempted on 2026-10-02 but the table-list query terminated on connection timeout. No Supabase schema mutation was performed as a result.

The production storefront is Render-hosted according to render.yaml. The public domain is configured for automatic deployment from main.

## Verification rule

Any future game schema change must follow:

INSPECT → CHANGE → VERIFY → PROOF

and must include:
- schema inspection
- RLS/access review
- test query
- advisor/security review where applicable
- Git commit
- CI result
- production exposure proof where the change is web-visible.
