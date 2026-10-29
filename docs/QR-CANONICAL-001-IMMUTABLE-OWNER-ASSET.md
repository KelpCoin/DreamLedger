# DreamLedger permanent canonical QR — QR-CANONICAL-001

Owner-confirmed 2026-10-29. **IMMUTABLE VISUAL IDENTITY.** Never silently regenerate or replace with a stock QR, icon, other design, or a new target.

## Exact original asset

- **Library path:** `/Brand Assets/DreamLedger-QR-CANONICAL-001-original.jpeg`
- **Library file ID:** `libfile_f7fee9b190fc8191ad978f40f4b2d04b`
- **Original uploaded bytes:** JPEG, 1280 × 1280, 82,063 bytes.
- **SHA-256:** `c795c6cc5b6b0e021fd5bd344ea0ac5773097e9ed51d1778844f0d8adeb190cf`
- **Visible design:** neon-cyan QR modules on black, magenta corner accents; preserve original pixels, border, colors and geometry.
- **Decoded QR payload:** `www.dreamledger.org` (confirmed after isolating bright-cyan modules / high-contrast threshold).
- **Actual destination:** canonical homepage `https://www.dreamledger.org/` / `https://dreamledger.org/`, subject to host redirects. The QR **does not** encode `/go/`. Never claim that scanning the supplied asset goes directly to `/go/`.
- The **homepage `/` itself must expose the CCA card carousel** so a QR visitor immediately discovers the spaces. Keep `/go/` as a compatible secondary doorway; do not swap the QR target.
- **Preserve owner-provided image exactly.** Do not rebuild it with a QR generation library. Deployment must copy the original artifact and independently verify SHA-256 equality. This GitHub document and JSON manifest describe the original; they are *not* image replacements.

## Release checks

1. Retrieve the exact original JPEG from the saved Library artifact and verify SHA-256 before putting it into any public site, social profile, print material, advertising asset or white-label template. Never substitute a similar-looking QR.
2. Check the decoded payload and test a **physical-device scan** from the original at typical display sizes and in print. OpenCV's unmodified whole-image detector did not detect it, while cyan-thresholded image decoding succeeded. That proves the payload, **not universal scan reliability**.
3. Open `www.dreamledger.org` on a phone and confirm `/` serves the discoverable CCA carousel, real cards and correct silo routes. Current public deployment and transaction status must be measured separately.
4. Ensure existing permalink and campaign mechanisms do not change the encoded QR payload; distribute attribution on the landing page and in optional downstream links instead.
5. Preserve backend tenant boundaries. The CCA carousel is a unified discovery UI, not shared authorization, inventory, customer records or payment privileges.
6. Do not deploy or publish replacements automatically. Public, payment and production changes require explicit owner approval and green tests.

## Commercial guardrail

A successful QR scan and a working carousel are **navigation evidence only**, not proof of a real buyer, settled payment, checkout/order attribution, available physical stock, or fulfilled delivery. Continue separate commercial proof and link-integrity checks before claiming readiness.
