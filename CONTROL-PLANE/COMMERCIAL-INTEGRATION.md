# Commercial Integration Control Plane

Status: ARMED / APPROVAL-GATED
Verified revenue: NZ$0

## Canonical surfaces

- DreamLedger: https://dreamledger.org
- Amplissa: https://amplissa.com
- Repository: https://github.com/KelpCoin/DreamLedger
- Checkout: https://buy.stripe.com/28EcN54zraG13M3g3idwc1t

Domain status is configuration, not proof of deployment. A green CI run never changes the revenue scoreboard.

## Operating lanes

1. Commerce: DreamLedger owns the customer-facing offer, checkout, fulfilment and proof boundary.
2. Brand / holding surface: Amplissa is treated as a separate public brand surface. No private BEC/CUBE implementation material is published there by this repository.
3. IP custody: IP manifests remain versioned in GitHub. Private implementation doctrine is not copied into public marketing artifacts.
4. QR: one durable doorway may redirect to a controlled landing surface later. The QR asset is not itself a payment receipt.
5. Markets: regional offers are represented as data and copy, not as claims that every regional checkout is currently live.
6. Social: content is generated and linted by the system but publication remains human approval-gated.
7. Gauntlet: every candidate commercial change passes compile, public-boundary and economic-truth checks before it can be considered release-ready.

## Multi-LLM refinement

When the Windows machine is available, LM Studio is the local refinement engine. It may use multiple local models in iterative proposer -> critic -> synthesizer passes.

When the PC is off, GitHub Actions can run the same refinement contract against a configured cloud OpenAI-compatible endpoint. This is a fallback execution plane, not a claim that LM Studio itself is running in GitHub Actions.

The cloud fallback is disabled unless the required repository secrets are explicitly configured. No secret is stored in this repository.

## Revenue boundary

Automation may compile, test, lint, package, generate QR assets and create proof artifacts. It must not fabricate payment, publication, testimonials, traffic, customer identity or revenue.

External social publication, irreversible production deployment and any public commercial action remain approval-gated.

## PC-off principle

The GitHub runner is the continuity layer for deterministic work that does not require the local GPU. GPU-bound LM Studio work remains local. Cloud LLM refinement is an explicitly configured substitute when the PC is unavailable.

## Proof contract

Every orchestration run must emit:

- commit SHA
- UTC timestamp
- selected execution plane
- Gauntlet result
- compile result
- refinement result
- revenue claim = NOT_VERIFIED_BY_AUTOMATION

A proof artifact is operational evidence only. It is not economic evidence.
