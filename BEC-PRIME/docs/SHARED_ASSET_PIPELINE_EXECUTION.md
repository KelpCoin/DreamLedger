# Shared Asset Pipeline Execution

Demand Radar / avatar-runtime demand signal
-> Elohim Refinery
-> canonical SKU + asset provenance
-> Gauntlet
-> Approval Governor
-> Dreamiez VRM surface + Kelp Atlantis GLB surface
-> shared registry
-> server-authoritative checkout
-> verified settlement webhook
-> two-surface Fossil

## Rules

1. One canonical asset ID, never two duplicated commercial objects.
2. Both ecosystems are mandatory before publication.
3. Browser demand signals may request generation but cannot publish or sell assets.
4. Elohim is the refinement stage. Gauntlet is the adversarial gate.
5. Approval is explicit before a candidate becomes publishable.
6. Checkout is server-authoritative.
7. A sale is not recorded until a verified settlement webhook provides a real transaction ID.
8. A two-surface Fossil must contain both Dreamiez and Kelp Atlantis render targets.
9. Third-party source assets retain their own licenses. Open-source does not mean automatically commercial or redistributable.

## Current pipeline fixtures

- BEC-DUAL-0001 / Dream Shell
- BEC-DUAL-0002 / Kelp Guard
- BEC-DUAL-0003 / Elohim Bloom

The repository contains three valid GLB pipeline fixtures. Their Dreamiez VRM targets reference CC0 candidates from the Open Source Avatars registry. They remain `candidate` and `approval_required=true` until the upstream license metadata is independently verified and the assets pass the real Gauntlet.

## Money gate

No asset is marked sold by fixture creation. The first real sale must originate from the server checkout path and produce a real transaction ID. The resulting Fossil is the only accepted evidence of revenue.
