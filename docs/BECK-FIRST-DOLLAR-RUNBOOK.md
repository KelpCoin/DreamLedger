# BECK First-Dollar Runbook

Date: 2026-08-31

## Objective

Produce one independently verified real external payment. Until that happens, BECK is PRE-MONEY.

## Economic order

1. MTG / EDH_0001: NZ$400, platform fee 0% forever.
2. MTG / EDH One-Link: automate deck URL to draft commercial package.
3. MTG inventory-aware customization: 10% and 20% upgrades.
4. MTG Cinema: optional digital enhancement.
5. Amplissa: 5% flat platform fee.
6. BBW/SSBBW creator portal: 5% flat platform fee.
7. DreamMeez and future silos: 5% flat.

## Production gate

A sale attempt is allowed only after all applicable gates pass:

- deployed commit is verified through the public version endpoint;
- public product catalogue is reachable;
- MTG silo boundary verifier passes;
- silo fee policy verifier passes;
- webhook signature verification is enabled;
- checkout is backed by an approved product and correct currency/amount;
- payment evidence will be taken from Stripe, not from local checkout state;
- public posting remains human-approved.

## First sale target

The immediate target is EDH_0001 at NZ$400 because it is already represented as a published physical MTG product in the commercial catalogue and the MTG fee is zero.

The NZ$50 DreamLedger 3000 founding tile is a valid fallback commercial surface if the MTG checkout is not converged, but it does not replace the MTG revenue wedge as the primary factory target.

## EDH One-Link acceptance

Input:

- one supported HTTPS ManaBox/public deck URL.

Required generated outputs:

- normalized deck manifest;
- commander/card metadata;
- maximum five MTG comparison decks;
- FIXTURE_BENCHMARK evidence;
- primer;
- hero prompt/asset record;
- optional Cinema recipe;
- draft catalogue record;
- PROOF.json;
- explicit approval state.

Generation alone must never create a checkoutable or paid state.

## Payment acceptance

PASS requires:

- real external buyer;
- live processor payment;
- independently verified amount and currency;
- verified webhook signature;
- product and silo recorded;
- settlement proof written;
- fulfilment completed or explicitly pending;
- no cross-silo boundary violation;
- no invented revenue claim.

## Stop conditions

Stop and fail closed if:

- production serves an unexpected commit or surface;
- a non-MTG checkout resolves to zero fee;
- a browser-supplied fee changes the server fee;
- a mixed-silo cart is accepted;
- a non-MTG seller lacks verified Stripe Connect state;
- webhook signature verification fails;
- payment evidence exists only in local UI/ledger state;
- an unapproved product becomes publicly checkoutable;
- silo content leaks across public surfaces.

## After RA_000001

Only after the first verified payment:

- expand EDH One-Link usage;
- add inventory-aware customization;
- add Cinema generation;
- build Amplissa production surface;
- build BBW/SSBBW creator onboarding and one-time purchase flow;
- widen creator-commerce automation.
