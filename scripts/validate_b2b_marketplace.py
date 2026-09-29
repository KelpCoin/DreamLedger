#!/usr/bin/env python3
import json
from pathlib import Path

catalog=json.loads(Path("public/catalog.json").read_text())
assert catalog.get("schema")=="dreamledger/public-catalogue/v1"
products=catalog.get("products",[])
quote=next(p for p in products if p.get("sku")=="QUOTE-COMPARE-49")
assert quote.get("status")=="published"
assert quote.get("checkout_available") is True
assert quote.get("checkout_url","").startswith("https://buy.stripe.com/")
contract=quote.get("fulfillment_contract") or {}
assert contract.get("human_gate") is None
assert contract.get("buyer_inputs")
assert contract.get("automated_work")
assert contract.get("completion_condition")
p301=Path("docs/UNIVERSAL-PAIN-OBSERVATORY-P301-P400.md").read_text()
assert p301.count("### P") == 100
market=Path("public/b2b.html").read_text()
assert "B2B Exchange" in market
server=Path("public/server.js").read_text()
assert "'/b2b':'b2b.html'" in server
print("B2B_MARKETPLACE_VALIDATION=PASS")
print("PAIN_CORPUS_P301_P400=100")
print("QUOTE_COMPARISON_AUTOMATED_FULFILLMENT=PASS")
print("ECONOMIC_TRUTH=UNCHANGED_UNTIL_SETTLED_EXTERNAL_PAYMENT_AND_VERIFIED_FULFILLMENT")
