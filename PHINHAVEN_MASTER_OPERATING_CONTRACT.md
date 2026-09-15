# PHINHAVEN Master Operating Contract

Status: BLOCKED_PENDING_CANONICAL_RUNTIME
Canonical repository: KelpCoin/DreamLedger
Canonical branch: main
Work packet: FIN-PHIN-RECON-001

## 1. Purpose

PHINHAVEN is the canonical name for the persistent fantasy RPG/game formerly represented by Kelplantis, Project Eden, DreamMeez and BECK-era work. Historical names are recovery references only. New game-facing material must use PHINHAVEN.

This document joins the game specification, evidence discipline, deployment model and commercial gate into one operating contract.

## 2. Authority order

1. Canonical repository state
2. Authoritative production database state
3. Verified deployment/runtime state
4. Verified external player/payment evidence
5. Historical/sandbox artifacts
6. Design documents and hypotheses

Historical or sandbox material may identify recovery candidates. It cannot silently become production truth.

## 3. Current verified reconciliation

The canonical repository contains substantial DreamLedger commercial infrastructure and Kelplantis-era database work. It does not currently expose a discoverable PHINHAVEN Godot project or project.godot file through repository inspection. Therefore the executable PHINHAVEN runtime is not yet canonical and the game build cannot be declared production-ready.

The repository does contain game-side database migrations covering cross-game items, economic event graph work, resource nodes/harvest, resource inventory/realtime hardening, parcels/anchor state, authoritative claim/spawn inspection and reconciliation. These are evidence of backend work, not proof of a complete playable game.

The Stripe rail has also materially advanced. Commit a19e432b6a48ed29b8cf41f54e2e923bf10d4d93 repairs acceptance of Stripe `payment_intent.succeeded` events and Checkout Session attribution. This still requires real external payment proof before any BusinessTruth claim.

## 4. Game architecture

The MVP is one complete vertical slice:

CREATE CHARACTER -> SANCTUARY -> PREPARE -> DANGEROUS FLOOR -> FIGHT/EXPLORE/GATHER -> LOOT -> RISK DECISION -> RETURN OR DIE -> TRADE -> CRAFT -> BOSS/EVENT -> SOUL TOME -> REPEAT

Initial slice:

- one sanctuary
- one dangerous floor
- one enemy family
- one boss
- one resource
- one craftable
- one currency
- one inventory
- one direct trade system
- one market
- one death model
- one dynamic event
- one Soul Tome
- one cosmetic

Do not build 100 floors before the first loop survives player testing.

## 5. Multiplayer authority

Client authority:
- input
- intent
- presentation

Server authority:
- movement validation
- combat
- inventory
- ownership
- currency
- item state
- trading
- market settlement
- death consequences
- authoritative events

Gameplay-critical actions must not rely on `@rpc("any_peer")` as an authority shortcut.

Every peer executing the same Godot script must carry identical `@rpc` signatures. RPC declarations are part of the compatibility contract.

## 6. Database boundary

Supabase remains the shared authoritative data layer.

Public/client-facing access must use an intentionally exposed API surface. Economically critical internals must not simply be exposed because RLS exists.

Internal truth includes, where applicable:

- Stripe webhook events
- economic events
- ledgers
- ownership state
- settlement state
- control reconciliations
- entitlement state

Required protections:

- dedicated non-exposed API boundary for internal economic tables
- RLS on exposed tables
- least-privilege grants
- backend-only service/secret credentials
- authoritative mutations through controlled server-side operations

Realtime is synchronization, presence and notification. It is not the source of economic truth.

## 7. Economy contract

Minimum authoritative primitives:

- player
- currency
- item
- ownership
- transaction
- ledger

Minimum operations:

- grant/mint
- transfer
- earn
- spend
- buy
- sell
- trade
- destroy

All mutations must be atomic and auditable.

Transaction identity must permit legitimate lifecycle transitions. Duplicate protection must not incorrectly reject the same transaction across its lifecycle. Where event identity is used, the event type/state transition must participate in the idempotency contract.

Every faucet requires a gameplay reason. Every sink requires a gameplay reason.

## 8. Event contract

Candidate authoritative events include:

PLAYER_CREATED
PLAYER_ENTERED_FLOOR
PLAYER_LEFT_FLOOR
ENEMY_SPAWNED
ENEMY_DEFEATED
ITEM_DROPPED
ITEM_PICKED_UP
ITEM_EQUIPPED
ITEM_DESTROYED
RESOURCE_GATHERED
PLAYER_DIED
PLAYER_RESPAWNED
CRAFT_STARTED
CRAFT_COMPLETED
TRADE_CREATED
TRADE_ACCEPTED
TRADE_COMMITTED
MARKET_LISTED
MARKET_PURCHASED
MARKET_CANCELLED
BOSS_STARTED
BOSS_DEFEATED
WORLD_EVENT_STARTED
WORLD_EVENT_ENDED
COSMETIC_UNLOCKED
PURCHASE_SETTLED
ENTITLEMENT_GRANTED

Final production names must be frozen before broad implementation.

## 9. Content mutation

Content generation is candidate generation, never automatic production authority.

Pipeline:

GENERATE -> SCHEMA VALIDATE -> GAMEPLAY VALIDATE -> ECONOMIC VALIDATE -> BALANCE TEST -> REVIEW -> APPROVE -> PUBLISH

ELOHIM creates candidates. GAUNTLET judges candidates. No generated object may create uncontrolled currency or bypass authoritative ownership/settlement rules.

## 10. Item provenance and Soul Tome

Important items and resources should eventually carry provenance such as:

- creator
- recovery location/floor
- discovery
- significant use
- ownership history
- relevant boss/event
- major trade history

The Soul Tome derives from authoritative validated events, not UI counters or client claims.

## 11. Commercial contract

PHINHAVEN is not monetized merely because a Stripe product or checkout exists.

BusinessTruth requires:

REAL EXTERNAL BUYER
+
SETTLED STRIPE PAYMENT
+
CORRECT ATTRIBUTION
+
ENTITLEMENT
+
FULFILLMENT
+
PROOF

Anything else is TEST, SIMULATED, UNVERIFIED, UNMATCHED, STALE or INTERNAL as appropriate.

The first commercial product should be non-competitive identity value, such as a cosmetic/title/banner/founder recognition package. Do not sell combat power as the first monetization mechanism.

## 12. Stripe webhook contract

Webhook processing must:

- verify the raw request body against Stripe signature
- run with JWT verification disabled for the webhook endpoint where appropriate
- persist event identity
- deduplicate by Stripe event ID
- use business-level idempotency guards
- be order-independent
- use upsert/state reconciliation rather than assuming event order
- validate amount, currency, SKU and attribution
- separate payment settlement from entitlement and fulfillment
- never double-fulfill a retry
- write proof only after the relevant chain is actually complete

A browser success/redirect page is not payment truth.

## 13. Monetization sequence

PHASE A: PROVE THE GAME

1. recover/import canonical Godot runtime
2. run one complete vertical slice
3. verify server authority
4. verify inventory/ownership/economy
5. verify one player can complete the loop

PHASE B: PROVE THE PURCHASE

1. create one PHINHAVEN identity cosmetic offer
2. bind SKU to the authoritative catalog
3. checkout through Stripe
4. receive and process settlement
5. grant entitlement
6. fulfill
7. write proof
8. independently verify the chain

PHASE C: REPEATABILITY

Only after one working silo/product exists should repeated commercial structure be extracted into templates. Do not build a template system for nonexistent silos.

PHASE D: SCALE

1 slice -> 3 slices -> 10 -> 25 -> 50 -> 100 floors

Scale content only when evidence justifies it.

## 14. Autonomy model

The desired system is self-running wherever cloud infrastructure can legitimately perform the work.

Cloud-capable responsibilities:

- public website
- checkout
- Stripe webhook processing
- database persistence
- entitlement/fulfillment logic
- proof storage
- scheduled checks
- GitHub automation
- deployment pipelines
- monitoring and reconciliation

PC-dependent responsibilities:

- local Godot development
- local Godot testing/building unless CI builds it
- local workers
- local agent bridge processes
- local LM Studio/Ollama workers
- any bootstrap that has not been migrated to hosted infrastructure

Therefore the user's PC should not be treated as the permanent production server. The target architecture is: cloud production, GitHub control plane, Supabase evidence/data plane, hosted runtime where required, and local PC only as a development/worker node.

## 15. User operating requirement

The user should not need to keep the PC on for ordinary customer checkout, payment processing, entitlement, fulfillment or hosted website operation once those services are actually deployed and verified.

The user will still be required for human gates that cannot honestly be automated, including:

- approval of public release where required
- approval of live financial actions where required
- provision/rotation of secrets or credentials
- physical/local development actions when no cloud equivalent exists
- real-world player/customer participation when external evidence is required

The system cannot manufacture external demand. Automation can operate a working commercial machine; it cannot guarantee that strangers will buy a product that has not been proven desirable.

## 16. Current gate

PHINHAVEN_RECON_V0.1 = BLOCKED_PENDING_CANONICAL_RUNTIME

No broad game implementation is authorized by this document until the actual canonical Godot runtime is located or intentionally imported and reconciled.

No PHINHAVEN revenue claim is authorized until BusinessTruth closes.

## 17. Next execution order

1. Locate/recover the actual Godot project.
2. Establish its canonical repository path.
3. Record exact Godot version and main scene.
4. Verify sanctuary and dangerous-floor scenes.
5. Verify player/controller and multiplayer scripts.
6. Verify RPC signatures and server authority.
7. Reconcile existing Kelplantis database work against actual runtime needs.
8. Build only the smallest missing economy/runtime components.
9. Run one complete vertical slice.
10. Verify the result.
11. Package one cosmetic commercial offer.
12. Verify the Stripe -> entitlement -> fulfillment -> proof chain.
13. Only then extract reusable commercial patterns.

The governing rule is:

BUILD ONE. PROVE ONE. EXTRACT ONE. THEN MAKE THE NEXT NINE BORING.
