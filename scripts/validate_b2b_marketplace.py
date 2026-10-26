#!/usr/bin/env python3
"""Validate catalog structure without confusing a listing flag with live commerce."""
import json
from pathlib import Path

catalog = json.loads(Path("public/catalog.json").read_text(encoding="utf-8"))
assert catalog.get("schema") == "dreamledger/public-catalogue/v1"
products = catalog.get("products", [])
quote = next((p for p in products if p.get("sku") == "QUOTE-COMPARE-49"), None)
assert quote is not None, "QUOTE-COMPARE-49 missing from catalog"
assert quote.get("status") in {"draft", "review", "published", "suspended", "retired"}
assert isinstance(quote.get("checkout_available"), bool), "checkout_available must be an explicit boolean"
contract = quote.get("fulfillment_contract") or {}
assert isinstance(contract, dict)
assert isinstance(contract.get("buyer_inputs", []), list)
assert isinstance(contract.get("automated_work", []), list)
assert isinstance(contract.get("completion_condition", ""), str)

pain = Path("docs/UNIVERSAL-PAIN-OBSERVATORY-P301-P400.md").read_text(encoding="utf-8")
assert pain.count("### P") == 100, "expected 100 pain-corpus entries"
market = Path("public/b2b.html").read_text(encoding="utf-8")
assert "Post RFQ" in market or "Post a request" in market
server = Path("public/server.js").read_text(encoding="utf-8")
assert "'/b2b':'b2b.html'" in server

print("B2B_MARKETPLACE_STRUCTURE=PASS")
print("PAIN_CORPUS_P301_P400=100")
print("QUOTE_COMPARISON_CHECKOUT=" + ("CLAIMED_AVAILABLE_REQUIRES_SEPARATE_E2E_PROOF" if quote["checkout_available"] else "HOLD")
)
print("ECONOMIC_TRUTH=UNCHANGED_UNTIL_EXTERNAL_SETTLEMENT_FULFILLMENT_DELIVERY_AND_RECONCILIATION")
