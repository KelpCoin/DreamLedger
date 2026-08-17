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

## Commercial control plane

- Public commerce surface: https://dreamledger.org
- Brand / holding surface: https://amplissa.com
- Canonical repository: https://github.com/KelpCoin/DreamLedger
- Current NZ$29 checkout: https://buy.stripe.com/28EcN54zraG13M3g3idwc1t
- Permanent QR policy: `IP/QR/QR-DESTINATION.txt`
- Markets: `MARKETS/MARKET-MATRIX.md`
- Social distribution: `SOCIAL/SOCIAL-VIRALITY-PLAYBOOK.md`
- IP custody: `IP/MASTER-IP-MAP.md` and `IP/PUBLIC-IP-MANIFEST.md`
- Execution architecture: `CONTROL-PLANE/COMMERCIAL-INTEGRATION.md`

Domain presence is not deployment proof. Payment is not claimed until external payment evidence exists.

## Local and PC-off execution

When the Windows GPU is available, LM Studio is the preferred local multi-LLM refinement plane. The intended iterative loop is proposer -> critic -> synthesizer -> Gauntlet -> proof.

When the PC is off, GitHub Actions provides deterministic continuity for compile, verification, Gauntlet, packaging and proof. An explicitly configured cloud LLM endpoint can optionally perform the refinement stage. LM Studio itself is not assumed to run in GitHub Actions.

See `CONTROL-PLANE/LM-STUDIO-MULTI-LLM.md` and `.github/workflows/pc-off-refinement-gauntlet.yml`.

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

## Development rule

Prefer extending the existing canonical infrastructure over creating parallel ledgers, duplicated item databases, or ecosystem-specific ownership systems.

## Revenue truth

Current verified revenue remains NZ$0 until a real external payment is independently evidenced. CI, CD, QR generation, IP registration, market research, Gauntlet passes and social-content generation do not alter that number.
