#!/usr/bin/env python3
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
manifest=json.loads((ROOT/"public/evergreen-silo-factory.json").read_text())
live=manifest.get("live_adapters",[])
pains=manifest.get("pain_vectors",[])
assert len(pains)==100, f"expected 100 pain vectors, got {len(pains)}"
assert len(live)==10, f"expected 10 live adapters, got {len(live)}"
server=(ROOT/"public/server.js").read_text()
for item in live:
    route=item["route"]
    slug=item["slug"]
    assert route in server, f"route missing from server: {route}"
    assert (ROOT/"public"/"silos"/f"{slug}.html").exists(), f"page missing: {slug}"
    assert item["checkout_url"].startswith("https://buy.stripe.com/"), f"invalid checkout: {slug}"
    assert item["fulfillment"]=="SUPPLIER_QUOTE_COMPARISON", f"unexpected fulfillment: {slug}"
print("EVERGREEN_SILO_FACTORY=PASS")
print("PAIN_VECTORS=100")
print("LIVE_AUTOMATED_ADAPTERS=10")
print("ECONOMIC_TRUTH=UNCHANGED_UNTIL_SETTLED_EXTERNAL_PAYMENT_AND_VERIFIED_FULFILLMENT")
