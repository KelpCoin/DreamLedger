# BECK Empire Commerce Handover Dossier

Date: 2026-08-31
Status: executable roadmap

## Executive decision

BECK is not a collection of dashboards. It is a set of isolated commercial surfaces sharing a common control plane, evidence model, compiler discipline, and payment policy.

The immediate economic objective is the first verified dollar, not architectural completeness.

The canonical order is:

MAIN -> SECURITY -> STOREFRONT -> PAYMENT -> PROOF -> FIRST SALE -> SCALE

DreamLedger MTG is the first revenue wedge. The EDH One-Link pipeline is the first factory. Amplissa and the BBW/SSBBW creator portal are separate commercial silos. They may share infrastructure patterns, but they must never share public payloads, catalogues, routes, assets, or checkout references unless explicitly permitted by a silo contract.

## Silo economics

| Silo | Public surface | Platform fee | Rule |
|---|---|---:|---|
| MTG | dreamledger.org/mtg | 0% | 0% forever |
| Amplissa | amplissa.com | 5% | flat |
| BBW/SSBBW creator portal | dedicated creator surface | 5% | flat |
| Any future silo | its own declared surface | 5% | flat default |

The only zero-fee silo is MTG. The policy is server-side and fail-closed. Browser supplied commission values are not trusted.

For marketplace transactions, non-MTG sellers must have a verified Stripe Connect account before checkout. The intended settlement model is a destination charge with a platform application fee. Stripe's current Connect guidance supports destination charges for marketplace transactions where funds do not need to be held and a transaction has one connected seller. The platform owns marketplace pricing and loss liability in this model.

## Revenue wedge: EDH One-Link

Input: one public HTTPS ManaBox deck URL.

Output: a draft, evidence-backed MTG catalogue package containing:

1. normalized deck manifest;
2. commander and card metadata;
3. up to five published MTG carousel comparison decks;
4. deterministic fixture benchmark explicitly labelled FIXTURE_BENCHMARK;
5. evidence-first primer;
6. hero-media prompt and generated-art placeholder/asset;
7. optional Cinema generation recipe;
8. catalogue record;
9. immutable proof manifest;
10. approval-gated commercial state.

The pipeline is already merged in PR #211 and the live commercial slice is merged in PR #212. Those PRs establish the implementation boundary: generation does not automatically create a checkoutable product.

ManaBox officially documents URL import for Aetherhub, Archidekt, Deckstats, Moxfield, MTGTop8, Scryfall, TCGplayer and Untapped.gg, and supports sharing decks by link. This makes URL ingestion a credible first-party input contract.

## The first-dollar path

The shortest path is deliberately boring:

1. Keep EDH_0001 as the immediate NZ$400 commercial target.
2. Confirm its published status, inventory and checkout surface.
3. Verify live `/version`, `/api/products`, `/sitemap.xml`, and MTG silo boundary.
4. Confirm Stripe live checkout can settle and produce webhook proof.
5. Put the EDH One-Link input surface in front of a real buyer.
6. Accept one real stranger payment.
7. Fulfil manually if necessary.
8. Record processor evidence separately from local ledger evidence.
9. Only then widen the automated factory.

The first dollar is the terminal acceptance test. Local green checks are necessary but do not count as revenue.

## Roadmap A: Revenue-first

### A0: Storefront truth

- production must serve the merged commit;
- `/version` must identify the deployed commit and `public-v6` surface;
- `/api/products` must return the MTG catalogue;
- `/sitemap.xml` and `/robots.txt` must be reachable;
- MTG boundary proof must pass;
- obsolete production contracts must be removed from the gate.

### A1: Payment truth

- use live Stripe only for the final revenue test;
- rotate leaked/old keys outside source control;
- keep webhook signature verification mandatory;
- preserve idempotency keys;
- never infer payment from a local checkout-created record;
- only a processor-confirmed paid event may create settlement proof.

### A2: EDH One-Link

- accept a ManaBox/public deck URL;
- normalize card names through the chosen MTG data layer;
- cap carousel comparison set at five;
- generate benchmark evidence with the FIXTURE_BENCHMARK label;
- generate primer;
- generate hero prompt;
- write draft catalogue product;
- write PROOF.json;
- require explicit approval before publishing/selling.

### A3: First sale

Do not add generic creator tooling before a real sale. Run the pipeline on one real deck, make the package good enough to buy, and put it in front of qualified prospects.

### A4: Inventory-aware customization

After the first sale, add collection-aware substitutions. Candidate score should consider legality, commander identity, inventory availability, curve fit, synergy evidence, buyer constraints, and benchmark delta. Cap customization to the declared 10% and 20% commercial packages initially.

### A5: Cinema

Treat Cinema as an enhancement/upsell. It must never block the deck product. Generate a hero image first. Add short motion only when the local GPU workflow is reliable.

## Roadmap B: Empire control plane

### B0: Canonical contracts

Every silo declares:

- silo id;
- public domains;
- allowed routes;
- catalogue roots;
- payment policy;
- fee policy;
- asset roots;
- prohibited cross-silo terms/domains;
- approval requirements;
- evidence schema.

### B1: Compiler

The compiler turns silo source material into deployable public output. Compiled output is the only allowed public payload. Source repositories remain silo-owned.

### B2: Truth Oracle

Every release receives a truth state:

VERIFIED / UNVERIFIED / CONTRADICTED / STALE

Production claims must reference independent evidence where available.

### B3: Gauntlet

Every candidate receives:

PASS / FAIL / QUARANTINE / NEEDS_EVIDENCE

A failed boundary, payment invariant or approval requirement is fail-closed.

### B4: Proof

Each execution writes a machine-readable proof. The minimum proof includes timestamp, schema, silo, input hash, output hash, policy hash, execution status and verifier identity.

### B5: Watchdog

The watchdog checks:

- production version drift;
- checkout endpoint health;
- webhook health;
- silo boundary drift;
- fee policy drift;
- stale catalogue outputs;
- failed CI gates.

Alerts must be actionable and should not trigger public posting.

## Roadmap C: Amplissa

Amplissa is a hard-separated silo. The compiler should build the existing `amplissa.com` surface from its own source tree and never import MTG catalogue payloads.

Minimum commercial surface:

- landing page;
- creator identity/profile;
- content catalogue;
- controlled preview surface;
- checkout;
- fulfilment/entitlement record;
- creator earnings record;
- 5% platform fee calculation;
- approval-gated public publishing;
- proof receipt.

The fee must be resolved from the Amplissa silo id on the server. A browser cannot change it to zero.

## Roadmap D: BBW/SSBBW creator portal

This is a creator marketplace, not an MTG extension and not an Amplissa route alias.

Minimum viable portal:

- creator onboarding;
- creator profile;
- content upload;
- draft/review/published state machine;
- content catalogue;
- buyer checkout;
- 5% platform fee;
- creator net proceeds;
- purchase entitlement;
- takedown/moderation controls;
- proof receipt;
- strict silo boundary.

The portal should launch with one-time purchases before subscriptions. The simplest successful transaction is more valuable than a large creator dashboard.

## Roadmap E: Generic creator commerce engine

Only after the EDH wedge proves demand:

TREND SIGNAL -> WORD BANK -> STENCIL -> GENERATION RECIPE -> LOCAL LLM -> COMFYUI -> ASSET -> CATALOGUE -> APPROVAL -> CHECKOUT -> SETTLEMENT -> PROOF

`word_bank` stores weighted terms and decay metadata.

`stencil` stores reusable generation templates.

`generation_recipe` maps a stencil to a generation workflow and required inputs.

`signal_weight` adjusts candidate weights from observed demand signals.

Community voting changes weights only through authenticated, auditable events. No vote should directly publish a commercial asset.

## Technical substrate map

### Web/storefront

Node.js public shell, compiled HTML, strict route allow-list, security headers, version endpoint, robots and sitemap.

### Commerce

Catalogue JSON is the source contract. Checkout creates an idempotent Stripe Checkout Session. Webhook verification is mandatory. Settlement proof is created only after Stripe confirms payment.

### Marketplace

Stripe Connect is the intended model for 5% non-MTG creator transactions. Initial launch should use one seller per transaction and destination charges. Multi-seller carts are a later phase.

### AI

Local LLMs remain the default for private generation where quality is sufficient. vLLM is a viable OpenAI-compatible serving layer. Its current documentation explicitly supports OpenAI-compatible chat/completions APIs and structured outputs, making it suitable as a local inference substrate.

### Image/video

ComfyUI is the generation substrate. Image generation is first. Video is optional and must not become a dependency of checkout.

### Data

Scryfall/MTG data is normalized into a local manifest/cache for MTG. Buyer and seller records must remain in their silo's data roots. Inventory data must never leak into unrelated public surfaces.

### Evidence

Hashes, manifests and proof receipts live outside transient UI state. A UI showing `paid` is not evidence of payment. Stripe webhook evidence is.

## Security substrate

1. No secret keys in Git.
2. Rotate keys after exposure or uncertainty.
3. Webhook signatures required.
4. Idempotency on every money-creating request.
5. Server-side fee policy.
6. Approval gate before public publishing.
7. Silo allow-lists and forbidden-domain scans.
8. No cross-silo checkout metadata.
9. No automatic public posting.
10. Fail closed on policy mismatch.

## Commercial state machine

DRAFT -> VERIFIED -> APPROVED -> PUBLISHED -> CHECKOUTABLE -> PAID -> FULFILLED -> SETTLED

Invalid transitions are rejected. Generation may create DRAFT. Generation cannot create PAID. Checkout creation cannot create SETTLED. Only a verified processor event can create PAID/SETTLED evidence.

## First-dollar acceptance test

PASS requires all of:

- one real external buyer;
- one real payment processor event in live mode;
- amount and currency independently confirmed;
- product/silo recorded;
- webhook signature verified;
- settlement proof written;
- fulfilment completed or explicitly accepted as pending;
- no boundary violation;
- no invented revenue claim.

Until this test passes, BECK remains PRE-MONEY regardless of how many local tests pass.

## What not to build yet

Do not build a generic creator dashboard, trend marketplace, voting network, animation studio, or multi-vendor cart as a prerequisite for the first dollar.

The economic sequence is:

EDH_0001 -> first payment -> EDH One-Link -> inventory customization -> Cinema -> creator portal -> Amplissa scale -> generic creator engine.

## Current implementation note

This handover is accompanied by a server-side silo fee policy and verifier. The current branch also updates the marketplace checkout path so non-MTG checkout requires a connected seller and applies the declared 5% application fee, while MTG remains 0%.

The fee policy is intentionally versioned in Git so changing it requires a code review and CI pass.
