# CUBE B2B Marketplace v1

The B2B marketplace aggregates approved listings from CUBE silos without collapsing source identity.

Supported source silos: mtg, dreammeez, media-music, digital-products, nz-secondhand.

Rules:
- seller and source-silo metadata remain attached to every listing;
- no fabricated inventory;
- public listings require the applicable approval state;
- payments and fulfillment must produce evidence before revenue is counted;
- future multi-vendor settlement can use Stripe Connect after seller onboarding is implemented.

Primary surfaces:
- /marketplace.html
- /api/cube/silos
- /api/cube/marketplace
