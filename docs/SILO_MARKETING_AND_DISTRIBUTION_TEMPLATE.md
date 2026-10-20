# Reusable Silo Growth and Creator-Support Contract

This is the default growth contract for new DreamLedger silos. MTG is the first configured example, not a one-off implementation. Clone the contract and supply silo-specific values rather than copying MTG branding into unrelated verticals.

## Default experience

- The marketplace is the primary product. Buying, selling, listing, search and other advertised free features must not be gated by a creator-support prompt.
- Creator support is optional and low-key. Use a sidebar, article end, footer or author card. Never use a blocking modal, checkout interstitial or repeated intrusive banner.
- A silo must declare its own fee policy. Do not silently copy MTG's 0% fee override into another silo.
- Use one canonical first-party silo URL as the QR destination. Do not encode a temporary Patreon or other third-party URL. Add source attribution through redirect/query handling only where supported and privacy-appropriate.
- Do not enable a support link until its destination has been verified. The current Patreon destination is intentionally null and UNVERIFIED in the config, so this template cannot invent or publish a URL.

## Content distribution

Each original item should have one canonical content record containing at minimum: content ID, silo ID, title, canonical URL, source author, public/paid boundary, approved destinations, platform-specific excerpt, link-check status, approval status and publication receipts.

Generate adapted drafts for the owned site, Patreon, Tumblr and Discord from that record. External auto-publishing remains disabled by default until a platform integration is confirmed, permissions are checked, and the publication action is explicitly authorized. Draft generation is automatable; public posting is not automatically authorized by the existence of a draft.

Never copy Patreon-paid text into public pages, Tumblr, Discord or public feeds. Preserve the source's paywall boundary and canonical attribution. No cold-DM campaigns, scraped audience lists or unsolicited bulk messages.

## Measurement and commercial truth

Keep page visits, article reads, QR visits, support clicks, free memberships, paid memberships and settled revenue as separate measures. Clicks and free memberships are not revenue. A commercial revenue claim requires independent payment settlement, attribution, fulfillment and retrievable delivery evidence.

## Clone workflow

1. Copy `config/silo-growth-defaults.json` into the silo manifest or its generated config.
2. Set `silo_id`, `silo_slug`, canonical URL, fee policy and creator-support label.
3. Verify all destinations. Leave missing destinations null and fail closed.
4. Generate a non-intrusive support component with `node BEC-PRIME/scripts/render-silo-growth-promo.js path/to/silo-growth.json`. The renderer emits no public markup unless the destination is HTTPS and explicitly marked `VERIFIED`.
5. Generate QR assets from the canonical first-party URL, with source variants if supported.
6. Generate channel-specific drafts from canonical content records.
7. Run `node BEC-PRIME/scripts/verify-silo-growth-contract.js` and the normal silo boundary, fee and public-surface checks.
8. Require human approval for first publication, new destinations, paywall-boundary changes and production payment changes.
9. Record actual publication receipts and attribution. Never infer publication or revenue from a successful build.

## Writing quality

AI-drafted, human-finished original content should preserve the author's real observations and stance; use specific, verified names and details; vary sentence and paragraph rhythm naturally; avoid boilerplate transitions, repetitive summaries, fake anecdotes and fabricated evidence. Voice checks are editorial guidance, not detector-evasion guarantees. Disclose AI assistance proportionately where appropriate. Do not manufacture a human persona or claim experiences the author did not provide.

## MTG override

MTG may use the label “Support Happy Homarid's original Magic writing” after the actual Patreon destination is verified. Keep the marketplace and listing tools free as promised, and keep paid Patreon content behind Patreon access controls. Do not apply MTG branding or its permanent 0% fee override to other silos by default.


## Five-layer engineering stack

The factory coordinates five separate responsibilities:
- **Model:** proposes work and cannot certify its own result.
- **Harness:** scopes context, permissions, tools and secrets using least privilege.
- **Loop:** applies deterministic verification, bounded retries and explicit stop conditions.
- **Graph:** routes outputs to independent evaluators, deterministic checks, quarantine or human approval.
- **Factory:** clones canonical contracts and schedules many workflows while preserving tenant/silo isolation.

Machine-readable contract: `config/agentic-engineering-stack.json`. Verify it with `node BEC-PRIME/scripts/verify-agentic-engineering-stack.js`. The worker that builds a change is not the authority that certifies it; passing a dedicated test is not proof of production deployment.

## Optional product-customization offers

Machine-readable reusable rules live in `config/offer-customization-defaults.json`. The eligibility evaluator is `BEC-PRIME/scripts/evaluate-customization-eligibility.js`. Run it against an evidence-bearing evaluation input with:

```sh
node BEC-PRIME/scripts/evaluate-customization-eligibility.js path/to/evaluation-input.json
```

The evaluator returns explicit reason codes and fails closed unless the base product is published and in stock, its purchase path is verified, its decklist is present and 100 cards, an independent legality proof matches the current decklist fingerprint, the customization price is approved, and at least 20 distinct verified, physical, compatible swap options are available and unreserved.

For each custom order, two independent order-time gates remain separate:
- `requires_inventory_reservation_before_fulfilment`
- `requires_price_difference_approval_before_payment`

The first prevents promising a card that cannot be pulled. The second prevents charging an unapproved difference. Both are rechecked at the relevant point in the order lifecycle. The base “Ready to Play” purchase path must remain available even when customization is disabled.

The MTG $19 service price is only a proposed pilot value. The MTG override remains disabled and `PROPOSED_NOT_VALIDATED`; do not display the upgrade until the price, purchase route, decklist evidence, eligibility pool and actual reservation mechanism are verified. The public MTG catalogue currently does not satisfy those gates, so no live CTA is implied by these files.
