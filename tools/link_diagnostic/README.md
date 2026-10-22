# link_diagnostic

Offline Stripe **payment-link configuration** diagnostic. Stdlib only. No network. No AI.

## What it does
Reviews exported payment links against optional rules (metadata keys, currency, redirects, excluded terms).
Emits **free** (problem *types* + SHA-256 commitment) and **full** (per-link codes + fixes) reports.

## What it does not do
Does **not** charge, call Stripe, prove webhooks, fulfilment, or revenue. Config review only.

## Usage
```bash
python tools/link_diagnostic/link_diagnostic.py links.json --rules rules.json --out report_dir
python -m unittest tools.link_diagnostic.test_link_diagnostic -v
# or from this directory:
cd tools/link_diagnostic && python -m unittest test_link_diagnostic -v
```

## Example rules.json
```json
{
  "required_metadata_any": ["sku_id", "sku", "dreamledger_sku"],
  "expected_currency": "nzd",
  "allowed_redirect_hosts": ["dreamledger.org", "www.dreamledger.org"],
  "require_redirect": true,
  "redirect_needs_session_placeholder": true,
  "excluded_terms": []
}
```
