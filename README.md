# DreamLedger

DreamLedger is an independent commerce and digital-world verification surface.

The public product is intentionally small: structured offers, focused checkout surfaces, canonical item identity, and evidence-gated economic claims.

## Public principles

- Evidence before claims.
- A checkout surface is not proof of payment.
- A test fixture is never treated as real economic evidence.
- Canonical items are defined once and may be presented by multiple compatible experiences.
- Avatar and game surfaces reference the same canonical item identity rather than creating duplicate item records.
- Private implementation details, credentials, customer data, internal controls, and unpublished operational material are not part of the public product surface.

## Shared item model

The canonical item model lives under `item-schema/`.

An item declares its identity, kind, compatible experiences, and economic acquisition state. Presentation layers may project the canonical object for their own UI, but they do not become alternate sources of truth.

The example fixture demonstrates three cases:

- `ITEM_BLADE_0003`: compatible with avatar and RPG experiences.
- `AVATAR_HAT_0001`: avatar-only.
- `RPG_SWORD_0001`: RPG-only.

`economic.acquisition_proof_ref` is an evidence reference. It is not, by itself, an ownership claim.

## Commerce verification

DreamLedger verifies commercial state independently of any single commerce platform. Public claims are limited to what can be supported by observable evidence.

A real payment is only considered verified after external payment evidence has been received and the economic proof chain has been generated from that evidence.

## Public website

https://dreamledger.org

The website intentionally exposes customer-facing commerce and product information only. Internal architecture, operational procedures, secrets, private evidence, and unfinished experiments belong outside the public surface.

## Development rule

Prefer extending the existing canonical infrastructure over creating parallel ledgers, duplicated item databases, or ecosystem-specific ownership systems.
