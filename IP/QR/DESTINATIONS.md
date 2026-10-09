# Canonical QR destinations

The default QR is a free-value doorway. Do not route general-purpose scans directly to a paid checkout.

| Code purpose | Destination | Status rule |
|---|---|---|
| General / canonical QR | `https://dreamledger.org/?src=qr-canonical#quote-tool` | Canonical target; verify the encoded asset before printing |
| Compatibility doorway | `https://dreamledger.org/go/` | Must redirect to the canonical free worksheet |
| Supplier quote tool campaign | `https://dreamledger.org/?src=qr-quote-compare#quote-tool` | Free worksheet; tool completion is not a sale |
| MTG silo browse | `https://dreamledger.org/mtg` | Verify public route and useful free result before distribution |
| Paid product checkout | Existing product-specific buy URL only | Use only for explicitly product-specific placements, not the general QR |

Do not print QR codes to `/start` or `/q/*` until those routes return the intended content and have been tested.

Before calling an asset production-ready, decode its QR payload, compare it with this table, scan it on a phone, and verify the final landing experience. Repository presence alone is not proof that a QR code works.
