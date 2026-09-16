# Canonical QR distribution

## Canonical target

```
https://dreamledger.org/?src=qr-canonical
```

Optional product deep links:

- Tile: `https://dreamledger.org/?src=qr-tile#featured`
- Diagnostic: `https://dreamledger.org/mtg?src=qr-diag`
- Stripe tile direct: use only on physical print if page load is unreliable

## Asset

- Placeholder: `public/assets/qr-canonical.svg`
- **Action for local/CI agent:** run `BEC-PRIME` QRCompiler / `qrcode` against the canonical URL → overwrite SVG/PNG in `public/assets/` and `BEC-PRIME/compiled/qr/`.
- Catalog was empty (`count: 0`) as of 2026-08-28 — this must be regenerated.

## Auto-post corners (allowed channels only)

| Channel | Mode | Frequency | Notes |
|---------|------|-----------|-------|
| Own Discord | Pin + footer | Always | Safe |
| Own X / social | Image post | 1–2 / week | Track `src=` |
| Physical NZ venues | Print sticker | Manual | Billboard / LGS if permitted |
| Reddit | **Comment value first**, QR rare | Only if rules allow | Prefer text link |
| Substack notes | Own publication | When you have a list | Don’t inject into others |
| GitHub README / About | Static | Once | OK |

**Do not:** mass-post QR to unrelated subs, email lists you don’t own, or paid ads without budget approval.

## Agent queue item

```json
{
  "job": "QR_DISTRIBUTE",
  "url": "https://dreamledger.org/?src=qr-canonical",
  "asset": "public/assets/qr-canonical.svg",
  "status": "needs_real_qr_modules",
  "next": "run QRCompiler → commit PNG/SVG → post own channels"
}
```
