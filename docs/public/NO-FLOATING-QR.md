# No floating QR on the website

**Policy:** Visitors who already loaded `dreamledger.org` do not need a corner QR.

| Surface | QR allowed? |
|---------|-------------|
| Homepage / shop / product pages | **No** |
| Login / register / account | **No** |
| Print / physical stickers | **Yes** — `/qr/overpaying` or exported neon asset |

Broken or wrong QR assets must not be injected into HTML.

Implementation: `public/qrSurfacePreload.js` no longer patches `res.end`.
