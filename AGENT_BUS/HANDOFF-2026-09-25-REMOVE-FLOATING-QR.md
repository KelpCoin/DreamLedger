# HANDOFF — Remove floating QR

## OBSERVED

Live HTML injected `#dreamledger-qr-overpaying-power` bottom-right via `qrSurfacePreload.js` res.end patch. Wrong for main page; not the neon asset; broken UX.

## CHANGED

- Disabled HTML injection in `public/qrSurfacePreload.js`
- Neutralised `canonical-qr-inject.js`
- Policy: `docs/public/NO-FLOATING-QR.md`

## NEXT

Redeploy. Confirm home has no fixed QR div.
