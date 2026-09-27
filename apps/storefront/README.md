# DreamLedger Commerce

Shopify-like merchant surface: catalog, product pages, checkout boundary, order/evidence architecture, and responsive storefront UI.

## Current boundary
The checkout route is fail-closed. It will not create fake orders or pretend that a payment occurred. Wire the existing live payment provider only after provider credentials and fulfillment mapping are deliberately configured.

## Run
npm install
npm run dev
