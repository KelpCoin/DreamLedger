# BECK QUOTE-COMPARE-49: offline deterministic core

This is a local-first normalization and comparison core. It accepts JSON extracted from supplier quotes, produces canonical comparison JSON and a SHA-256 output seal, and refuses to claim a cheapest supplier when currency or cost fields are incomplete.

## Run
python tools/quote_compare/quote_compare.py tools/quote_compare/example_quotes.json --output D:/BrownEyeCortex/ARTIFACTS/quote-comparison.json

## Verify
python -m unittest discover -s tools/quote_compare -p "test_*.py" -v

## Boundaries
- No network access, model key, subscription, payment or public posting is required.
- PDF OCR is a separate extraction step; do not pretend extracted fields are verified facts.
- Source-file hashes and evidence references should be populated by the extraction adapter.
- This comparator does not determine tax treatment, compliance or procurement suitability.
- Synthetic sample values are test fixtures only and must never be represented as real quotes.
- A product sale is not established by passing these tests. RA_000001 still requires an external buyer, settled payment, fulfilled deliverable, delivery evidence and reconciliation.
