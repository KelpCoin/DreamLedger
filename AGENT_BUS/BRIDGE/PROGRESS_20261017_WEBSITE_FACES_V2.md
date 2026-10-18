# Website generation continued — 2026-10-17

## Emitted faces (public/)
| Face | Route |
|------|-------|
| home | / (home.html) |
| money | /money.html |
| shop | /shop.html |
| start | /start.html |
| offers | /offers.html |
| cash | /cash.html → money |

## Source of truth
`BEC-PRIME/compiler/face-registry.json`

## Run
```bash
node BEC-PRIME/compiler/WebsiteFaceCompiler.js
```

## Marker
All faces include `meta name="bec-compiler" content="WebsiteFaceCompiler"`

## Next
- MTG face from silo.json + catalog
- Wire `bec website` → WebsiteFaceCompiler
- Render deploy
