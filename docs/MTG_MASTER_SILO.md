# DreamLedger MTG Master Silo

Status: CANONICAL OPERATING REFERENCE

Magic: The Gathering / HappyHomarid is the DreamLedger Master Silo proving ground.

MTG is strategically important because it is the claimed silo and the place where the reusable commerce machinery is exercised against real physical inventory, condition, pricing, liquidity, fulfillment, buyer preference, membership, evidence, and attribution.

MTG is not the destination of DreamLedger. The commerce kernel must remain reusable for other silos.

## Commercial fee policy

Global DreamLedger platform fee: 5%.

Permanent MTG / HappyHomarid scoped override: 0%.

The 5% default is configurable policy, not a hardcoded constant.

MTG's 0% status is a permanent contractual rule.

Platform participation is separate from external rail costs.

Rail costs belong to evidence-layer economics:
- marketplace fees
- payment processing
- shipping
- FX spread
- dealer deductions
- other externally imposed transaction costs

The MTG evidence engine calculates those costs. It does not calculate or assume DreamLedger's platform fee.

## Singles catalog

Initial target: approximately 20 individually sellable high-value cards selected by Biggie.

Each published card should capture, where available:
- exact identity
- set / printing
- foil / treatment
- language
- condition
- quantity
- asking price
- evidence-backed market reference
- current NZ specialist-retail comparison
- availability
- buyer-facing media
- fulfillment method

Pricing principle:

Proposed prices should be cross-referenced against current NZ specialist card-shop retail for the same or materially comparable printing and condition.

Target: below the relevant NZ specialist-shop price where the comparison is valid.

Do not claim "cheapest in New Zealand" without current evidence.

Individual-seller asks are not the reference ceiling for this rule.

If a valid NZ specialist-shop comparison cannot be established, mark the pricing comparison UNVERIFIED / HOLD rather than guessing.

## Commander decks

Default product model: 80% prepared core + 20% buyer-directed customization.

The prepared core supplies the tested identity, strategy, core engine, and ready-to-play experience.

The customization layer can cover:
- approved commander/family choices
- theme emphasis
- power / budget adjustment
- preferred cards
- cuts and additions
- flavour / identity
- local-meta or playgroup preferences

Provide an optional deeper bespoke path for buyers who want substantially more involvement.

Customization must have explicit scope, price bands, turnaround, and available choices.

The product principle is: the buyer is finishing a deck that becomes theirs, not merely purchasing a fixed list.

## Catalog mix

The public MTG surface should present a genuine commerce catalog:

Singles + Commander decks + deck customization + diagnostic/advisory products + member intelligence.

CMD-DIAG is one product. It is not the identity of the MTG silo.

## Progressive transparency

HappyHomarid uses an onion model.

Outer layer:
- public catalog
- public product descriptions
- public evidence-backed pricing where appropriate
- public educational material

Inner layer:
- member-only market intelligence
- arbitrage opportunities
- deeper evidence
- alerts
- watch / act opportunities
- Discord distribution
- Patreon membership entitlements

Public transparency establishes trust. Paid membership exposes deeper, fresher, more actionable intelligence.

Arbitrage intelligence is a commercial asset and is not automatically public merely because underlying source information may be public.

## Master Silo acceptance test

One reusable commerce kernel must support:

physical asset → catalog item → offer → surface → attribution → checkout → settlement → fulfillment → independent evidence → learning

while preserving:
- silo identity
- asset identity
- SKU identity
- surface identity
- buyer attribution
- condition and evidence
- liquidity
- fulfillment state
- immutable economic truth

No MTG-specific payment or settlement fork.

## Human input boundary

Biggie supplies facts only he can reliably provide:
- actual availability
- condition
- exact printing / treatment when uncertain
- tentative deck names
- ballpark prices
- customization preferences
- fulfillment constraints

Machine work:
- normalization
- evidence collection
- NZ retail comparison
- economic calculation
- uncertainty flags
- listing preparation
- deterministic artifacts
- catalog state
- reconciliation

Never invent inventory, condition, price, or demand.

## Next intake

Singles: approximately 20 high-value card names/details.

Decks: tentative names + commander + ballpark prices.

Those inputs become the next validated MTG catalog batch.

## Canonical MTG Deck Sales Post Schema v1

Status: LOCKED FOR MTG SALES POSTS. This schema governs every Magic: The Gathering deck-sale post across DreamLedger / MTG / HappyHomarid. Preserve this section order. Replace only listing-specific facts. Unknown values must be flagged for review, never invented. Drafts require factual validation and human approval before publication.

### Required section order

1. **Title:** `[Commander] – [Deck Name]`.
2. **Opening identity paragraph:** colour identity, archetype, core play pattern, known format/set context, and concise positioning hook. Claims about popularity, community consensus, or “sleeper” status must be supported or clearly framed as opinion.
3. **Commander mechanics:** explain the relevant ability and how the deck converts it into value. Check current Oracle text where exact rules wording matters.
4. **Deck contents and synergies:** representative named cards, their roles, engine pieces, and mana-base notes. Do not claim a card is included unless supported by the submitted decklist.
5. **Play experience:** strengths, trade-offs, and the intended game plan. Claims such as “sleeved” and “playtested” require seller confirmation.
6. **Player Archetype:** a consistent labelled block with a concise description of the intended pilot and playstyle.
7. **Price and priority offer:** NZD price, shipping coverage, and membership discount/priority where applicable. Confirm actual terms.
8. **Payment:** state only verified payment methods and provide a safe next step. Use an approved live checkout/payment link where available. Never request card details in DMs. Do not claim Afterpay support unless the actual checkout supports it.
9. **Decklist link:** exact supplied decklist URL.
10. **Community link:** Patreon or other approved community URL when relevant.
11. **Hashtags:** concise, relevant tags.

### Reusable listing data contract

`title`, `commander`, `deck_name`, `colour_identity`, `archetype_strategy`, `opening_hook`, `commander_mechanics`, `synergy_cards`, `mana_base_notes`, `play_experience`, `player_archetype_label`, `player_archetype_copy`, `price_nzd`, `member_price_nzd`, `member_terms`, `shipping_terms`, `payment_methods_verified`, `decklist_url`, `community_url`, `hashtags`, `availability_status`, `facts_verified_by`, `publication_status`.

### Exemplar and boundaries

The user-supplied **Edward Kenway – Pacin’ On The Plank** listing is the style/order exemplar. Its NZ$230 price, NZ$200 Patreon price, free Aotearoa shipping, Afterpay claim, deck contents, and playtesting/condition statements are specific to that listing and are not defaults.

Do not merge this fixed-deck sale format with the separate 80% prepared core + 20% buyer-directed customization offer. Primer, matchup, upgrade, and simulation sections are future enhancements only after the decklist-driven multi-colour primer pipeline exists and its output is verified. Until then, no primer is required or to be fabricated.

Publication workflow: **DRAFT → FACT CHECK → HUMAN APPROVAL → PUBLISH**. No automatic public posting.
