# CUBE Silo Template

CUBE owns the reusable economic/control substrate. A silo supplies identity, domain adapters, evidence sources, products, voice, and audience-specific configuration.

## Core layers

1. Identity
   - brand
   - voice
   - audience
   - public routes

2. Community and entitlements
   - membership provider
   - community provider
   - tier/role mapping
   - access rules

3. Signal collection
   - adapter registry
   - source collectors
   - observations
   - timestamps

4. Truth and evidence
   - verification status
   - evidence vault
   - source references
   - hashes where useful

5. Opportunity state
   - DETECTED
   - VERIFIED
   - INTERESTING
   - SELECTED
   - DRAFTED
   - APPROVED
   - PUBLISHED
   - CONVERTED / DID_NOT_CONVERT
   - ARCHIVED

6. Production
   - stencils
   - generators
   - human approval

7. Distribution
   - public posts
   - member posts
   - community alerts
   - short form

8. Commerce
   - products
   - payment provider
   - fulfillment
   - entitlement

9. Measurement
   - reach
   - free conversion
   - paid conversion
   - product revenue
   - cancellation

10. Demand memory
   - evidence vault
   - prediction ledger
   - outcomes
   - demand feedback

## Generic adapter rule

An adapter should expose a stable CUBE capability rather than leak provider-specific assumptions into the core.

Examples:

- `catalog` -> canonical metadata
- `pricing` -> observed/reference price
- `inventory` -> availability
- `community` -> membership/entitlement state
- `distribution` -> delivery/notification
- `commerce` -> payment/settlement truth
- `intelligence` -> audience/domain signals
- `demand` -> requests and observed demand
- `content` -> source material and publication state
- `memory` -> predictions and outcomes

The provider is configuration. The capability is the reusable interface.

## Portable objects

### Opportunity

`source -> observation -> evidence -> verification -> opportunity -> output -> outcome`

### Prediction

`subject -> thesis -> timestamp -> scheduled checks -> observed outcome`

### Evidence

`source -> observation -> verification -> decision -> outcome`

## HappyHomarid v1

The MTG-specific adapters are configured above the substrate:

- Scryfall: canonical card metadata
- Cardmarket: EU reference pricing
- EDHREC: Commander intelligence
- Deck Scout: NZ local pricing, initially manual if necessary
- Patreon + Discord: community and entitlement
- Stripe: payment truth

The first closed loop is intentionally tiny:

`one card -> one NZ/EU observation -> one opportunity -> one Spec Watch -> one prediction -> one measured outcome`

Do not build the full Opportunity Radar before this loop closes.

## Status discipline

Use only:

`VERIFIED | UNVERIFIED | CONTRADICTED | STALE | TEST | SIMULATED | INTERNAL | UNMATCHED`

A provider being configured does not make its data VERIFIED. Verification belongs to the observation/evidence layer.

## Cloud/local contract

GitHub is the versioned source for migrations, configuration contracts, bootstrap scripts, and tests.

Supabase is the shared runtime/evidence layer.

Local machines run reproducible checks and local Supabase where appropriate. No local-only state should be required for another model or worker to understand the current silo state.
