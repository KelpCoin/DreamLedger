import json
from pathlib import Path

root=Path(__file__).resolve().parents[1]
catalog=json.loads((root/"public/catalog.json").read_text())
products={p["id"]:p for p in catalog["products"]}

required={
 "QUOTE-COMPARE-49":49,
 "DOC-EXTRACT-50":5,
 "SUPPLIER-CHECK-50":5,
 "EVIDENCE-PACKET-10":10,
}
for sku,price in required.items():
    p=products.get(sku)
    assert p, f"missing {sku}"
    assert p["status"]=="published", f"{sku} not published"
    assert p["checkout_available"] is True, f"{sku} checkout unavailable"
    assert float(p["price"])==price, f"{sku} price mismatch"
    assert p.get("checkout_url","").startswith("https://buy.stripe.com/"), f"{sku} checkout is not Stripe"

print("TOLL_BOOTH_MVP_VALIDATION=PASS")
print("ECONOMIC_TRUTH=UNCHANGED_UNTIL_SETTLED_EXTERNAL_PAYMENT")
