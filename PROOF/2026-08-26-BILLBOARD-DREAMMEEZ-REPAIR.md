# DreamLedger Commercial Surface Repair Proof

Date: 2026-08-26

## Change
Restored the public DreamLedger front door to the intended commerce billboard.

## Public surface
- DreamLedger homepage is a commerce-world billboard.
- DreamMeez is explicitly visible and linked from the homepage.
- MTG is explicitly visible as an isolated commercial silo.
- Commander Deck Diagnostic is the public NZ$29 billboard offer.
- Stripe checkout remains the direct NZ$29 purchase path.
- No pre-payment decklist form is introduced.
- Adult/Amplissa content is not added to the public surface.

## Expected live routes
- https://dreamledger.org/
- https://dreamledger.org/mtg.html
- https://dreamledger.org/avatar.html

## Expected commercial CTA
https://buy.stripe.com/00w7sLaXP01n96nbN2dwc2l

## Deployment gate
The GitHub Pages workflow is configured to stage the root index.html and mtg.html, require the NZ$29 and Commander Deck Diagnostic strings, deploy to Pages, and verify the deployed page before passing.

## Truth status
SOURCE_REPAIRED = PASS
DEPLOYMENT_VERIFIED = PENDING
PAYMENT_SUCCEEDED = PENDING

## Verifier
Open https://dreamledger.org/ and confirm the billboard contains DREAMMEEZ, MTG, Commander Deck Diagnostic, NZ$29, and the Stripe CTA. Then open /mtg.html and confirm the same offer. Finally confirm the Stripe CTA opens the intended live checkout.
