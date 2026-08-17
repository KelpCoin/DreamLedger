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

## Execution spine

The system now has one explicit refinement and release spine:

`Signal -> LM Studio multi-LLM refinement -> Gauntlet -> approval gate -> DreamLedger -> checkout -> external payment evidence -> verified revenue`

When the Windows GPU is available, LM Studio is the preferred local refinement plane. The iterative contract is proposer -> critic -> synthesizer -> Gauntlet -> proof.

When the PC is off, GitHub Actions provides deterministic continuity for compile, integration verification, Gauntlet, packaging and proof. A configured cloud OpenAI-compatible endpoint can optionally perform the same proposer -> critic -> synthesizer refinement. LM Studio itself is never claimed to be running in GitHub Actions.

Social publication, irreversible production changes and other public commercial actions remain approval-gated. Automation cannot manufacture revenue, customers, traffic, testimonials, publication or payment evidence.

## 60-second verification

From `BEC-PRIME`:

`npm ci`

`npm run verify:integration`

`npm run compile`

`npm run gauntlet`

For local multi-LLM refinement with LM Studio, set `LLM_API_URL` to the local OpenAI-compatible endpoint and provide comma-separated `LLM_MODELS`, then run `npm run refine:iterative`.

For PC-off continuity, run the GitHub Actions workflow `PC-Off Refinement and Gauntlet`. Cloud refinement is opt-in and requires repository secrets; the default path is deterministic verification only.

## Shared item model

The canonical item model lives under `item-schema/`.

An item declares its identity, kind, compatible experiences, and economic acquisition state. Presentation layers may project the canonical object for their own UI, but they do not become alternate sources of truth.

## Commerce verification

DreamLedger verifies commercial state independently of any single commerce platform. Public claims are limited to what can be supported by observable evidence.

A real payment is only considered verified after external payment evidence has been received and the economic proof chain has been generated from that evidence.

## Revenue truth

Current verified revenue remains NZ$0 until a real external payment is independently evidenced. CI, CD, QR generation, IP registration, market research, Gauntlet passes and social-content generation do not alter that number.
