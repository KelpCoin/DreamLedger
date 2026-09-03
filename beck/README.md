# BECK 5.1-H integration

This directory contains the hardened inverse-shopping proof kernel integrated with DreamLedger.

The integration deliberately does not duplicate the existing Stripe settlement spine. DreamLedger already has a fail-closed live Stripe -> GitHub Actions -> Airtable reconciliation path. BECK supplies the eBay evidence side of the inverse-shopping experiment.

## Truth boundary

- eBay credentials are read only from process environment variables.
- Credentials are never written to proof artifacts.
- `-Live` is mandatory for the Windows entrypoint.
- A live OAuth exchange is required before an eBay search is accepted.
- The raw parsed eBay response is captured and hashed.
- Commercial revenue remains `UNPROVEN` regardless of eBay search success.
- An eBay search result is source-feasibility evidence, not proof of a customer, sale, or revenue.

## Files

- `beck/core/models.py` - canonical Wanted and Candidate objects.
- `beck/ebay/wanted_hunt.py` - live Browse API execution and proof creation.
- `beck/proof/verify_ebay_proof.py` - proof integrity verifier.
- `scripts/Invoke-WantedHuntProof.ps1` - Windows PowerShell 5.1 entrypoint.

## Run

```powershell
$env:EBAY_APP_ID = '...'
$env:EBAY_CERT_ID = '...'
powershell -NoProfile -ExecutionPolicy Bypass -File '.\scripts\Invoke-WantedHuntProof.ps1' -Live
```

The canonical artifact is `proof/ebay/latest-wanted-hunt-proof.json`.

## Revenue gate

`EBAY-001 PASS` does not change verified revenue. Revenue remains NZ$0 until the existing live Stripe settlement workflow recognizes a real paid NZ$29 NZD Checkout Session and writes the corresponding economic event.

## Remaining production work

The supplied BECK codebase included a broader mission runner and Stripe adapter. Those pieces are not copied as duplicates because DreamLedger already has an authoritative settlement implementation. The remaining work is to connect future Wanted records to the canonical hunt runner without weakening the existing settlement and approval gates.
