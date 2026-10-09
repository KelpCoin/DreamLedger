# Canonical QR distribution

## Canonical target

The general-purpose QR should deliver immediate free value, not send an unqualified visitor straight to checkout.

```
https://dreamledger.org/?src=qr-canonical#quote-tool
```

The compatibility doorway `/go/` should resolve to the same free worksheet and preserve campaign parameters. Product-specific QR codes may use their own free tool, but must not be described as the general canonical QR.

## Product-specific destinations

- Supplier quote comparison worksheet: `https://dreamledger.org/?src=qr-quote-compare#quote-tool`
- Commander / MTG diagnostic: use the free diagnostic surface only after its public route and result flow are verified.
- Paid checkout URLs are not the default destination for general-purpose QR codes.

## Asset integrity

- Candidate asset: `public/assets/qr-canonical.svg`
- The compiled QR catalog was recorded as empty (`count: 0`) on 2026-08-28.
- Do not certify or distribute the asset until its encoded URL is decoded and checked against the canonical target, and a scan test succeeds.
- Regenerate QR modules and catalog entries through the existing QRCompiler; do not hand-author fake QR modules.

## Attribution

Use explicit, source-specific parameters on each placement, for example:

- `utm_source=deckbox_qr` or `utm_source=lgs_counter`
- `utm_medium=print`
- `utm_campaign=commander_diagnostic` or `utm_campaign=quote_compare`

Preserve incoming UTM parameters through redirects. Record scan, tool completion, checkout start, settled payment, and delivered outcome as separate events. Do not infer scans or revenue from link clicks alone.

## Distribution boundaries

| Channel | Mode | Boundary |
|---|---|---|
| Own Discord | Pin/footer | Owned channel only |
| Own social accounts | Helpful post | No unsolicited DMs |
| Physical venues | Printed QR | Permission required |
| Reddit / communities | Native helpful contribution | Follow community rules; no mass-posting |
| Paid ads | Not enabled by this document | Requires budget approval |

Never claim a QR asset is valid, deployed, or producing traffic until the relevant artifact or external event is independently checked.
