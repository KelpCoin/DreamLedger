### Summary
This draft implements transparent marketplace pricing, free B2B participation, safe Commander listing routes, and a fail-closed policy for checkout and paid visibility. It is source-only and does not deploy to production.

### Commercial rules
- Browsing, listing creation, and B2B participation are free across all silos.
- Human-to-human marketplace transactions carry a 0% platform fee.
- A2A policy is 2% for x402 transactions, but x402 remains disabled until a real payment verifier, settlement check, and receipt flow are implemented and tested.
- Paid visibility is optional, with NZ$10 Featured Listing and NZ$25 Premium Spotlight definitions. The feature flag defaults off; no promotion can activate without explicit tenant entitlement plus verified payment and fulfillment.
- A Promoted badge is rendered only when a trusted server response explicitly returns `is_promoted: true`.

### MTG listing updates
- The catalogue now includes Edward Kenway (NZ$230), Quintorius (NZ$90), Dwynen (NZ$90), Jon Irenicus (NZ$220), Altaïr Ibn-La’Ahad (NZ$750), Kwain (NZ$650), Errant & Giada (NZ$300), and Misery Memorial (NZ$180).
- The supplied ManaBox links and Patreon member prices are shown as seller-supplied listing details.
- A shared deck-detail template renders a Request to Purchase form when checkout is not approved. It opens the buyer's email application and transparently tells them the request is not sent automatically and no payment is taken.
- Edward Kenway's stale NZ$400 catalogue entry is aligned to the seller-supplied NZ$230 ask. Checkout is explicitly disabled and no payment URL is embedded.
- Root, public, and compiled MTG storefront/catalogue copies are synchronized for review. The MTG compiler now emits the canonical deck-detail template.

### Safety boundaries
- No database migrations or schema changes.
- No live Stripe Payment Links changed or activated.
- No production deployment.
- No SKU checkout enabled by this PR.
- Paid visibility checkout is not enabled because payment, expiry, and placement-delivery proof are not yet integrated.
- No live x402 gateway or autonomous SRE remediation is enabled.

### Verification
Run `npm run verify:silo-fee-policy` and `npm run verify:transparent-commercial-model`. Source-level checks cover fee policy, catalogue mirrors, listing metadata, and fail-closed checkout/visibility rules. Live payment-to-fulfillment acceptance still requires a staging transaction and independent evidence before release.
