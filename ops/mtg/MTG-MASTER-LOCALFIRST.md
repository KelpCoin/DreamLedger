# MTG is the DreamLedger master commerce template

This drop is an offline-first *private intake and research kernel*, not a completed public marketplace or trading system. It does not require Supabase, Render, Google Sheets, an API key, or network access.

## Supported inputs

Drop any ManaBox exported CSV/TSV or raw `.txt` (one card per line) into `D:\BrownEyeCortexData\LAKE\MTG\INBOX`, or the same relative path under `C:` if D: is unavailable. Examples of raw parsing syntax:

- `2 Sol Ring (CMM) 397`
- `3x Lightning Bolt [M11] #149 foil`
- `4 Random Card`

CSV headers are flexibly detected: Card Name, Set Code, Collector Number, Quantity, Foil, Condition, Language, Kind, SKU, Cost NZD, Asking Price NZD and Scryfall ID. Sealed stock uses `Kind=sealed` and a unique `SKU`. Commander decks use `Kind=deck`. No scanner/export dump was included in this proof package, and no inventory is preloaded.

Run `Run-MTG.ps1` from the unzipped package. It does not post listings or send scanned data to the internet. The normalized inventory is stored in SQLite and exported to a private CSV plus phone-friendly local HTML preview.

## Match / verify / approve

A raw name alone produces `DRAFT_UNRESOLVED`. Set+collector number makes a single `DRAFT_MATCHABLE`, not a verified printing. An explicit Scryfall ID is accepted as an identifier claim, but physical condition, stock, and ownership still need manual confirmation before publication. No row auto-publishes.

Prices and arbitrage are **not invented**. Only two matching, dated, HTTPS-source comparables in NZD, one for a buy side and one for a sale side, can generate a candidate. These are *seller asks* unless independent execution/bid proof is recorded elsewhere. Candidates exclude old quotes, subtract shipping, fees and other supplied costs, but do not claim verified liquidity, tax, or demand.

To record observations, save a JSON list and run `python ops/mtg/mtg_market_kernel.py --db DBPATH comparable --json YOUR_OBSERVATIONS.json --out OUTPATH`:

```json
[
  {
    "asset_id": "VALUE_FROM_PRIVATE_DRAFTS_CSV",
    "side": "buy",
    "price_nzd": "15.00",
    "shipping_nzd": "3.00",
    "fee_percent": "0",
    "other_cost_nzd": "0",
    "url": "https://example.org/your-actual-source-url",
    "observed_at": "2026-10-21T08:00:00Z",
    "matching_print": true
  }
]
```

Example is fixture syntax only. Do **not** treat the example URL or price as a market observation. A paid MTGStocks-style product requires licensed price data and defensible comparable histories; Scryfall price fields alone are not a NZ retailer quote or profit proof. The public product must credit sources and respect licensing and cache requirements.

## Global policy (proposed, not deployed)

- Human listings and B2B merchant listings: NZD 0 listing fee and NZD 0 DreamLedger transaction commission. Processor and shipping fees are separate.
- Paid visibility: optional, labelled **Sponsored**; never implies verified trust or a higher organic ranking.
- A2A: metered, scoped, low-cost API keys, only once an entitlement and fulfillment receipt have been proved.
- MTG/HappyHomarid/CollectorsCoast kept strictly separate from other silo records, especially Amplissa/adult.
- No public post, listing, charge, customer contact, or spend without a separately approved and tested release.

## Road to public /mtg/

A: import real scans -> B: identify exact printing and inspect stock -> C: verify condition/photos and approved price -> D: stage private catalogue JSON -> E: approve listing to MTG only -> F: demonstrate buyer inquiry, payment and fulfill/delivery evidence. Source Supabase is currently storage exhausted; don't migrate by dumping a failed server or deleting WAL. Use new local-first inventory independently while source recovery is handled via support.

Verifier: `python -m unittest discover -s tests -p test_mtg_market_kernel.py -v` and `Run-MTG.ps1 -Verify` after a boot.