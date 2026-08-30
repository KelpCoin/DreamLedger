# DreamLedger homepage reset

Date: 2026-08-31

Status: IMPLEMENTED

Scope:
- Replaced the live public homepage with a catalogue-first, thumb-first storefront.
- Billboard is retained as a small pioneer product module and top-left discovery cue.
- DreamMee is confined to a small top-right interaction.
- Product discovery is organised into horizontal swipe rails.
- Removed public payment-logo clutter.
- Removed internal BECK PRIME, MCP, Gauntlet, Truth Oracle, Economic Court, RA_000001 and implementation language from the homepage.
- Public product claims are limited to catalogue facts and explicit product descriptions.
- Added a public GET /api/products proxy from the storefront to the server-authoritative product catalogue.

Public boundary:
- The storefront exposes only the public product projection.
- Internal engine credentials remain server-side.
- No Stripe secret is sent to the browser.
- No autonomous payment execution is added.

Production note:
- PR #193 is already merged on main.
- This homepage change is a separate production storefront change.
