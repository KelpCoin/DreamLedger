# Avatar dual-surface adapter (Web ↔ Phinhaven)

## Principle
One portable identity (`dreamledger_avatar_identity_v1` in localStorage).
Cosmetics are SKUs with two effect surfaces:

| Surface | Effect |
|---------|--------|
| **web** | Visual layer on DreamMeez studio + site chip |
| **phinhaven** | Buff metadata (perception, warmth, speed, …) — game applies rules |

## Files
- `public/assets/avatar-identity.js` — catalog, own/equip, export
- `public/assets/avatar-chip.js` — floating site-wide chip
- `public/avatar.html` — try-on studio (impulse NZ$2–5)
- `public/assets/avatar-runtime.js` — runtime contract

## Adapter API
```js
DreamLedgerAvatar.toPhinhavenLoadout()
// → { avatar_link, cosmetics[{sku,slot,visual,buff}], active_buffs, body }
```

Phinhaven Floor 1 should read `phinhaven_avatar_link_v1` (written on identity save) or call the same export after loading `avatar-identity.js`.

## Money
Impulse cosmetics priced NZ$2–5. Until per-SKU Stripe is complete, studio offers:
- local demo unlock (no revenue claim)
- live `/buy/DREAMMEEZ-SUPPORTER-SPROUT` for real settlement

## Gauntlet
No cosmetic becomes `checkout_available` without schema validation + Stripe URL.
