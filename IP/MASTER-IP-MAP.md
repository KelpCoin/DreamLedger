# DreamLedger / BrownEye Intellectual Property Map

As of 2026-08-17.

This document is an inventory and custody map. It is not a transfer of ownership, a legal registration, or a claim that every historical artifact is currently present in this repository.

## Economic truth

```text
VERIFIED_REVENUE_NZD = 0
VERIFIED_PAYMENT_COUNT = 0
FIRST_PAYMENT = NO
STATUS = UNPROVEN
```

Engineering activity is deliberately not counted as revenue.

## Canonical repositories

| Repository | Role | Visibility |
|---|---|---|
| `KelpCoin/DreamLedger` | Commerce, economic proof, compiler and CI/CD spine | Public |
| `KelpCoin/BrownEye-CUBE` | CUBE foundation, trust and execution IP | Private |
| `KelpCoin/DreamLogic` | Logic/IP component | Public |
| `KelpCoin/render-ingestor` | Render/ingestion component | Public |
| `KelpCoin/carousel-catalog` | Catalog surface | Public |
| `KelpCoin/pulse-catalog` | Catalog surface | Public |
| `KelpCoin/Happyhomarid` | HappyHomarid silo | Public |
| `KelpCoin/mtg-furnace-render` | MTG silo | Public |
| `KelpCoin/index.html` | Web asset | Public |
| `KelpCoin/kelpcoin-faucet-site` | Legacy web asset | Public |
| `KelpCoin/safehub` | Utility component | Public |

## Core IP domains

- BrownEye Cortex local-first automation architecture
- CUBE trust, verification and execution architecture
- DreamLedger commerce and economic proof architecture
- BEC-WEB-COMPILER manifest-to-commerce architecture
- Revenue OS primitives
- Discovery, demand calibration and opportunity scoring
- SKU factory and offer generation
- Fulfilment Wall and sellability invariants
- Trust/Gauntlet and approval-gated publication
- Parasitic Overlay contract
- Proof/Fossil and immutable economic evidence concepts
- Cloud Primary and GitHub Actions execution spine
- Payment-link and payment-verification integration concepts
- Billboard commercial wedge and pricing ladder
- Agentic-commerce control-layer concepts
- Local LM Studio bootstrap concepts
- Silo separation and governance policies

## Commercial specimen

The first economic specimen is the Billboard wedge:

```text
SKU = DL-BILLBOARD-100X100-001
PRICE = NZ$29
STATUS = ARMED_NOT_DEPLOYED
VERIFIED_REVENUE = NZ$0
```

The fulfilment invariant is:

```text
SELLABLE = PRODUCT_EXISTS
         AND PAYMENT_ENABLED
         AND FULFILMENT_CONTRACT_EXISTS
         AND DELIVERY_PATH_EXISTS
         AND RISK_POLICY_EXISTS
         AND PROOF_PATH_EXISTS
```

## Custody boundaries

Private BrownEye/CUBE implementation remains private unless explicitly approved for publication. Public repositories contain only material intended for their respective public surfaces.

No secrets belong in source control. Never commit API keys, tokens, passwords, webhook secrets, credentials or private customer data.

Adult/Amplissa IP must remain isolated from MTG, HappyHomarid and CollectorsCoast silos.

## CI/CD principle

GitHub Actions is the cloud execution and verification spine. CI may test, lint, compile, generate proof and report state. CI must not manufacture revenue claims, publish external marketing, or bypass human approval gates.
