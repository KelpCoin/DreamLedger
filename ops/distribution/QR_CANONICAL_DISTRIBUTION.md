# One canonical QR, all silos
The **single immutable QR symbol** lives at `public/qr/canonical.svg`.
It has been independently decoded from its existing pixel matrix (37 × 37)
as:

```text
https://dreamledger.org/?utm_source=qr&utm_medium=offline&utm_campaign=canonical
```

This QR payload is **not changed** by this patch. `public/assets/qr-canonical.svg`
is an byte-identical alias, replacing a non-scannable placeholder.
`BEC-PRIME/compiled/website/canonical-qr.html` refers to that same
asset rather than embedding a second fake image.

All niche, offer, shop and agent routing happens **after the scan**.
Do not generate or publish one QR per listing, change the QR encoding,
or create QR variants for campaigns. `/go` is an existing internal
one-doorway navigation page, not the encoded QR payload.

The business doorway must resolve correctly on mobile before any public
QR promotion. Current external domain/DNS, offer readiness, checkout
and fulfilment must be independently verified; this asset patch does
not grant permission to publish or advertise.

## Authority
- Single QR bytes are locked by `node --test BEC-PRIME/scripts/single-canonical-qr.test.js`
- Canonical code, historical printed scans, payment links, revenue and approved products remain unchanged
- All external promotion and paid actions need separate owner approval
