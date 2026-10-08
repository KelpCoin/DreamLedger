# Money-First External Adoption Plan

Status: ACTIVE
Truth: VERIFIED_EXTERNAL_REVENUE remains NZ$0.00 until independent settlement, fulfillment, and evidence are observed.

## Economic lanes

1. DreamMeez cosmetics
   - Existing: Supabase auth, dreammeez_avatars, owned_objects/soul_tome, avatar UI.
   - Missing: cosmetic catalogue, checkout metadata, verified Stripe webhook, idempotent entitlement, RLS, fulfillment/evidence.
   - Acceptance: one independent buyer can purchase one cosmetic and the entitlement is provably granted.

2. Internet Billboard
   - Existing: Founding Tile checkout, finite inventory, paid placement review, image add-on, submission API.
   - Missing: campaign-specific QR/URL attribution and evidence.
   - Acceptance: a buyer can purchase a tile and scans/conversions can be attributed without inventing traffic.

3. PhinHaven
   - Existing: social lobby, presence/chat, game and Market doors, DreamMeez/cosmetics surface.
   - Missing: game-door offer -> checkout -> entitlement -> avatar possession -> evidence.
   - Acceptance: an independently paid cosmetic appears in the buyer's owned inventory.

## Governance adoption rule

External repositories are references, not automatic dependencies. Verify repository existence, current version, license, security posture, compatibility, and measurable owner-load reduction before integration.

Microsoft Agent Governance Toolkit is verified as a current public-preview open-source governance project with policy enforcement, identity/trust, runtime controls, audit, and kill-switch capabilities. Map it against BECK before adopting components.

## Autonomy

Use earned autonomy as policy/configuration over the existing authority gate. Do not replace CUBE, public.jobs, Agent Bridge, BECK, or the existing claims firewall with a second orchestration system.

## Execution boundary

Every consequential agent action must pass identity, provenance/evidence, context, policy, and authority admissibility checks before external effect. LM Studio recommendations are never economic truth.

## Payment boundary

Checkout -> verified webhook -> idempotent entitlement -> RLS/access check -> fulfillment -> evidence.

A payment row, checkout start, test, simulation, or self-purchase is not VERIFIED_EXTERNAL_REVENUE.

## CI contract

CI validates:
- JSON configuration syntax
- Python syntax in runtime/economic and selected automation paths
- existence of the three money-lane source surfaces
- governance/adoption documentation
- no fake revenue values introduced by this change

CI does not declare revenue. External economic truth remains runtime/evidence-gated.
