# Commercial Integration Control Plane

Status: ARMED / APPROVAL-GATED
Verified revenue: NZ$0

## Canonical surfaces

- DreamLedger: https://dreamledger.org
- Amplissa: https://amplissa.com
- Repository: https://github.com/KelpCoin/DreamLedger
- Checkout: https://buy.stripe.com/28EcN54zraG13M3g3idwc1t

Domain status is configuration, not proof of deployment. A green CI run never changes the revenue scoreboard.

## Operating spine

1. Signal enters the system.
2. LM Studio performs local multi-LLM proposer -> critic -> synthesizer refinement when the Windows GPU is available.
3. The Gauntlet checks the candidate against compile, public-boundary and economic-truth rules.
4. Human approval is required before public publication or irreversible commercial action.
5. DreamLedger owns the public offer and checkout surface.
6. External payment evidence is the only event eligible to become verified revenue.
7. The resulting evidence chain becomes a proof artifact.

## PC-off continuity

When the PC is off, GitHub Actions is the continuity plane for deterministic verification and the Gauntlet. If the operator explicitly enables cloud refinement, the workflow can run the same proposer -> critic -> synthesizer contract against an OpenAI-compatible endpoint supplied through repository secrets.

LM Studio is never represented as running on GitHub Actions. The two planes are explicit:

- LOCAL_GPU: LM Studio multi-LLM refinement.
- GITHUB_CLOUD: deterministic verification, Gauntlet and optional cloud refinement.

## Commercial lanes

- Commerce: DreamLedger owns the customer-facing offer, checkout, fulfilment and proof boundary.
- Brand / holding surface: Amplissa is treated as a separate public brand surface. No private BEC/CUBE implementation material is published there by this repository.
- IP custody: IP manifests remain versioned in GitHub. Private implementation doctrine is not copied into public marketing artifacts.
- QR: one durable doorway may redirect to a controlled landing surface later. The QR asset is not itself a payment receipt.
- Markets: regional offers are represented as data and copy, not as claims that every regional checkout is currently live.
- Social: content is generated and linted by the system but publication remains human approval-gated.
- Gauntlet: every candidate commercial change passes verification before it can be considered release-ready.

## Revenue boundary

Automation may compile, test, lint, package, generate QR assets, refine copy and create proof artifacts. It must not fabricate payment, publication, testimonials, traffic, customer identity or revenue.

External social publication, irreversible production deployment and any public commercial action remain approval-gated.

## Proof contract

Every orchestration run should emit:

- commit SHA
- UTC timestamp
- selected execution plane
- integration verification result
- refinement result or NOT_REQUESTED
- Gauntlet result
- revenue claim = NOT_VERIFIED_BY_AUTOMATION

A proof artifact is operational evidence only. It is not economic evidence.
