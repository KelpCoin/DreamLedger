# DreamMeez base and layered fashion specification v1
2026-10-28 | State: PROTOTYPE CONTRACT, NOT FINISHED HAND-DRAWN ART

## Non-negotiable free identity
Every base silhouette, height, build, natural skin tone, fundamental hair option and essential accessibility representation is free without payment or subscription. Price belongs to optional fashion/expression only: jackets, backpacks, jewellery, shoes, special creative accessories, stickers and commissioned artwork. There is no larger-body surcharge and no separate "plus size unlock".

The website already has nine free heights and ten free builds. This release adds five independent free silhouette profiles (Straight, Balanced, Broad shoulders, Curved, Full figure) and a free blank-versus-smile face choice. The previews are **CSS geometry**, not human-drawn art; no original 5 cm sketch has been ingested. User-uploaded sketches or client identity photographs must not enter a public repository.

The proposed statement "Bitmoji charges for plus-size body shapes" is not verified and is **not** permitted in our marketing. DreamMeez competes on inclusive range, deliberate drawn art and audited fit, not on disparaging a competitor without proof.

## Source master
- Paper master target: 5 x 5 cm; 600 DPI scan when practical, colour calibration and uncut margins.
- Original physical sketch and unmodified high-resolution scan kept privately with artist-approved attribution, licence, creation date, scan SHA-256.
- **No face on the source base.** Head, expression/eyes/mouth, hair, clothing and accessories are separate layers. Current CSS demo shows a detachable smile or a blank canvas.
- A dark 0.5 to 0.8 mm felt-tip outline can work well, but is artist guidance, **not** a requirement or scientific authenticity test.
- A 5 cm square scan is not inherently native 4K. Upscaling to a 4K export is separately labelled, and cannot invent trustworthy sketch detail.
- Line variance is a recognisable aesthetic, never proof of who drew it. Source-chain records and artist sign-off support provenance; a SHA alone only verifies bytes.

## Draft rig contract
Canonical preview canvas: 1024 x 1024 logical coordinate space; X and Y normalized to 0..1 so imagery can be swapped without changing names. The runtime data lives in public/assets/dreammeez-free-bodies.js and the existing identity's shape field (1..5). Current 2D anchor names:
neck, shoulder_left/right, elbow_left/right, wrist_left/right, waist_left/right, hip_left/right, knee_left/right, ankle_left/right, strap_left/right, backpack_top/bottom.

These are draft shape-relative guides. Production illustrator corrections can modify the anchor values through a reviewed versioned migration. Layer fit is not automatic simply because anchors exist.

Logical render order (far to near):
1. rear coat panels, backpack and distant accessory straps;
2. legs, torso, arms and blank head base;
3. garments and straps matched to body-specific cage silhouette;
4. facial expression layer, hair and near accessories;
5. UI/caption layer (never baked into art).

Every clothing product needs a **body-fit matrix** for the five silhouettes by ten builds by nine heights (450 body configurations), plus overlapping layer checks, a low-screen-width rendering pass, and human sign-off on waistband, belly drape, bust/chest contour and straps. A matrix of numbers is not proof that no clipping occurs. If a garment fails one body, it cannot be universally marketed as compatible until corrected; never charge additional money for a body-specific corrective layer.

## Source-to-screen stages
SKETCH_PENDING -> PRIVATE_SCAN_RECEIVED -> INK_CLEANED_DRAFT -> ARTIST_APPROVED -> LAYER_ASSET_REVIEWED -> FIT_MATRIX_REVIEWED -> DELIVERY_TESTED -> PUBLIC_APPROVED.

The offline script ops/dreammeez/sketch_to_layers.py accepts a privately provided JPEG/PNG/TIFF, verifies operator rights confirmation, saves a transparent ink-only layer and writes the source/derived SHA-256 manifest to a **private output folder outside Git**. It does NOT use AI or claim artistic approval. The scan remains unchanged.

Optional AI enhancement must be a separately consented and recorded derivative from the source scan. Use edge-preserving / line-art guidance only after a human review of contour changes, skin/build representation, body measurement consistency and licensing. ControlNet weights or denoising strengths must be tested per source rather than hard-coded as safe or compatible on the user's hardware. Never feed a sketch to a third-party model without artist permission. Reject outputs that redraw anatomy or introduce unwanted figure reshaping.

## Fashion monetization gate
A paid cosmetic requires: artist-created original asset, signed permission, original/derived SHA-256 chain, mapped slot and silhouette anchors, transparent layers, fit-matrix proof, price and fulfilment contract, Stripe settlement proof, server-side entitlement and refund handling, explicit Biggie + Peggy public activation approval. Browser-local preview state is **not** purchase authority or ownership proof. Avoid urgency/limited quantities without real inventory enforcement.

The three proposed new USPs are stored as hypotheses:
- 201: Body neutrality as standard: all identity bodies free.
- 202: Artist-authored, reviewable figure shapes: no claim of magical AI immunity.
- 203: Inclusive fashion fits: no fee for plus-size fit, optional accessories may have a normal non-discriminatory price.

Brand/availability claims remain unproven until real source art, fit testing and settled-to-delivered purchase proof exist.
