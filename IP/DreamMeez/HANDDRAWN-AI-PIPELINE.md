# DreamMeez original artwork + AI enhancement pipeline

**Status: design protocol, not an asset-generation or paid-fulfilment claim.**

Each DreamMeez cosmetic begins with a human-created sketch. Drawn art is the master. AI can clean contours, generate alternate colourways, adjust proportions, upscale or split artwork into layers, but must not originate a copied Bitmoji character, partner item, trademark or trade dress.

## Private vault
Keep original PSD/Procreate/Krita/vector files and any reference photos in the private artist vault, not this public repository. Store only a SHA-256 checksum, public-safe job ID, license/consent flags and proposed final asset location in the BECK ledger. Do not upload private artwork, prompt secrets or model credentials into GitHub Actions artifacts.

## Factory states
1. **SHADOW_UNBUILT**: original market signal, proposed price, not a product.
2. **SKETCH_RECEIVED**: human-drawn original, artist credited and authorized, source SHA-256 verified.
3. **AI_ENHANCED_DRAFT**: source sketch preserved, tool/model recorded, permitted transformations and license checked.
4. **ARTIST_APPROVED**: human review signs off originality, face/body inclusivity, legibility and colourway.
5. **LAYERED_AND_TESTED**: export transparent SVG/PNG layers with slot, anchor points, multi-body fitting proof, mobile rendering and reduced-motion option.
6. **DELIVERY_TESTED**: product identity matches settled checkout and server-side entitlement. LocalStorage is never purchase authority.
7. **SHADOW_READY**: trust, tax, cancellation/refund details, purchase terms, owner approval recorded.
8. **PUBLIC_APPROVED**: explicit Biggie + Peggy approval, separately for each publishing surface, then BECK may list the SKU.

No automatic transition may skip a stage. The existing service-to-checkout-to-delivery pipeline must be verified before activating any paid cosmetic. In-game buffs and scarcity must not be implied unless actually enforced.

## Creative directions
- Inked outlines with slight hand variation, readable silhouettes and flat luminous colours.
- Independent sizing and fitting for very slim through very large avatar bodies, with no punitive restrictions.
- The same item can have a no-cost try-on preview while purchase and ownership remain strictly separated.
- Prefer coherent collections and colour variants rather than isolated random uploads.
- Allow buyer to preview, save locally, see the exact one-time/recurring price, and access purchases only after backend-confirmed entitlement.

## AI prompt contract
Input: approved original hand drawing plus its source checksum, permitted transformations, target slot, garment construction, DreamMeez style guide.
Output: changed layers, colourway variants, before/after evidence, license-compatible model record, risks/quality judgement, **draft_only: true**.
Forbidden: copying competitor visual assets, reading unrelated silos, fabricating checkout availability, altering approved sketch without provenance, or public posting.

**Evidence boundary:** The shadow catalogue in `IP/DreamMeez/shadow-cosmetics-20261028.json` holds candidate hypotheses and public signal links. It contains no customer purchases, no finished art and no commercial entitlements.
