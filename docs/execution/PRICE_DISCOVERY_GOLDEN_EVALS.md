# Price Discovery Cell: Execution Contract

Status: IMPLEMENTED / AWAITING FIRST EXTERNAL RUN
Objective: prove one real wanted-item discovery before adding automation.

## Economic contract
A candidate is useful only when the exact release/print, condition, seller, price, shipping, currency, FX and landed NZD cost are observable. A listing being visible is not a purchase or economic outcome.

## Phase 1: manual evidence
Target: AIM - Cold Water Music.
Run against Discogs manually. Capture three candidates, preferably NZ first and Australia second.

Required fields:
- exact release / release ID
- seller
- seller country
- media condition
- sleeve condition
- listing price
- listing currency
- shipping to NZ
- FX rate/source
- landed NZD
- observed_at
- decision: BUY / PASS
- reason

Do not infer an exact pressing from title text alone.

## Golden-case rule
A passing case must satisfy ALL required conditions. Do not use OR semantics for economic acceptance.

Minimum acceptance:
1. exact target resolution
2. condition meets floor
3. ship-from meets allowed countries
4. landed NZD is computable
5. landed NZD is at or below the case ceiling
6. evidence contains the source listing and observation timestamp

## Failure intake
Every discovered failure becomes a golden case:
- retrieval failure
- wrong release resolution
- condition mismatch
- shipping omission
- currency/FX error
- landed-cost error
- stale listing
- unavailable listing
- unsupported marketplace endpoint

## Tier model
FREE: existence signal.
PAID: exact candidate + evidence.
PREMIUM: earlier signal where the source permits it.

No entitlement claim is valid until the authorization boundary is tested.

## Peggy isolation invariant
A user must only be able to read their own wanted-item rows. The security test is explicit: authenticated Peggy access to Biggie-owned rows must return zero rows.

## Promotion rule
Manual evidence comes before watcher automation. Repeated successful manual runs justify automation. Do not promote an undocumented marketplace endpoint into a production dependency without a fallback.

## Scoreboard
Verified external payments: 0
Verified revenue: NZ$0
Manual runs: 0
Real alerts: 0
Landed-cost normalizations: 0
Tier gates exercised: 0
