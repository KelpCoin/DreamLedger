# HappyHomarid Customer Care

This directory is a private HappyHomarid customer-care substrate. HappyHomarid is an MTG silo exposed through `/mtg`; these customer-care assets must not be imported into DreamLedger root, Dreamiez, Amplissa, or other silos.

## Governing idea

The machine learns patterns from Biggie-approved customer-care output. It does not impersonate Biggie and it does not silently promote inferred style into production.

## Operational loop

Patreon member signal -> relationship context -> case classification -> stencil -> word-bank retrieval -> human-agent draft -> HappyHomarid Gauntlet -> PASS / REVIEW / QUARANTINE -> Biggie approval when required -> send -> member response -> style ledger -> pattern proposal -> Biggie approval.

## Files

- `CONFIG.json` defines the silo boundary and external-action policy.
- `WORD-BANK.json` defines the governed vocabulary schema.
- `STENCILS.json` contains the first 20 constrained response structures.
- `STYLE-LEDGER.json` defines the evidence captured from human edits.
- `PATTERN-ENGINE.json` defines how recurring style patterns become proposals.
- `GAUNTLET.json` defines safety, entitlement, privacy, policy and silo checks.

## Patreon boundary

This commit defines the governance substrate only. It does not claim that a Patreon API connection, message sender, member sync, or automated moderation action is currently live. Any future connector must feed member context into this namespace and must pass outgoing content through the Gauntlet before an external action.

## Human control

Refunds, compensation, entitlement changes, policy changes and uncertain cases remain human decisions. A generated draft is not evidence of authorization.
