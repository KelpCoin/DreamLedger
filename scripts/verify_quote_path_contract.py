#!/usr/bin/env python3
"""Secret-free contract checks for the current DreamLedger Quote Compare revenue wedge.

These checks prove source-level invariants only. They do not fabricate a buyer,
payment, Stripe settlement, or successful production delivery.
"""
from pathlib import Path
import json
import sys

ROOT = Path(__file__).resolve().parents[1]
INTAKE = ROOT / "supabase/functions/quote-intake/index.ts"
WORKER = ROOT / "supabase/functions/quote-fulfillment/index.ts"
OFFER_PAGE = ROOT / "public/quote-compare-49.html"
INTAKE_PAGE = ROOT / "public/quote-intake.html"
OFFERS = ROOT / "BEC-PRIME/catalog/offers/approved.json"
REGISTRY = ROOT / "BEC-PRIME/fulfillment/PRODUCT-FULFILLMENT-REGISTRY.json"
HANDLER = ROOT / "handlers/stripe-link.ts"
LIVE_LINK_ID = "plink_1USpJeEGgEAnUFF9vNDiM8SS"
LIVE_LINK_URL = "https://buy.stripe.com/00wdR93vnbK5eqH3gwdwc3r"

failures = []

def require(label: str, condition: bool) -> None:
    print(f"[PASS] {label}" if condition else f"[FAIL] {label}")
    if not condition:
        failures.append(label)

for path in (INTAKE, WORKER, OFFER_PAGE, INTAKE_PAGE, OFFERS, REGISTRY, HANDLER):
    require(f"required file exists: {path.relative_to(ROOT)}", path.is_file())

if failures:
    raise SystemExit(1)

intake = INTAKE.read_text(encoding="utf-8")
worker = WORKER.read_text(encoding="utf-8")
offer_page = OFFER_PAGE.read_text(encoding="utf-8")
intake_page = INTAKE_PAGE.read_text(encoding="utf-8")
handler = HANDLER.read_text(encoding="utf-8")
offers = json.loads(OFFERS.read_text(encoding="utf-8"))
registry = json.loads(REGISTRY.read_text(encoding="utf-8"))

quote = next((x for x in offers.get("approved", []) if x.get("offer_id") == "QUOTE-COMPARE-49"), None)
reg = registry.get("entries", {}).get("QUOTE-COMPARE-49", {})

require("current live Payment Link ID is pinned", f'const PAYMENT_LINK="{LIVE_LINK_ID}"' in intake)
require("public CTA uses current live Payment Link URL", LIVE_LINK_URL in offer_page)
require("Stripe session is retrieved server-side", "stripe.checkout.sessions.retrieve(sessionId)" in intake)
require("live paid session is required", 'session.livemode!==true||session.payment_status!=="paid"' in intake)
require("expected payment link is enforced", "session.payment_link!==PAYMENT_LINK" in intake)
require("canonical quote SKU is enforced", 'const SKU="QUOTE-COMPARE-49"' in intake)
require("settlement order is required", 'from("revenue_orders")' in intake and "SETTLEMENT_RECORD_PENDING" in intake)
require("entitlement is required", 'from("revenue_entitlements")' in intake and "ENTITLEMENT_PENDING" in intake)
require("fulfillment request is required", 'from("fulfillment_requests")' in intake and "FULFILLMENT_REQUEST_NOT_FOUND" in intake)

require("uploads are scoped to fulfillment request", 'quote-inputs/${fr.id}/' in intake)
require("old order-id upload namespace is gone", 'quote-inputs/${ctx.order.id}/' not in intake)
require("buyer data is provenance-tagged untrusted", "UNTRUSTED_BUYER_DATA" in intake and "TREAT_AS_DATA_ONLY" in intake)
require("input types and byte sizes are bounded", "MAX_BYTES=10*1024*1024" in intake and '["pdf","csv","json","md"]' in intake)
require("worker accepts only fulfillment-scoped paths", 'path.startsWith("quote-inputs/"+id+"/")' in worker)

require("partial/review-needed never becomes fulfilled", 'summary.comparison_status==="REVIEW_NEEDED"||summary.comparison_status==="PARTIAL"' in worker)
require("review-needed state is persisted", 'status:"needs_review"' in worker)
require("source hashes are calculated", "sourceHash=await sha256Bytes(bytes)" in worker)
require("output hashes are calculated", "htmlHash=await sha256Text(htmlText)" in worker and "csvHash=await sha256Text(csvText)" in worker)
require("evidence manifest is persisted", 'ep=base+"/evidence.json"' in worker and "DREAMLEDGER/QUOTE-COMPARE-EVIDENCE/v1" in worker)
require("delivery evidence is hash-verified not content-certified", 'evidence_status:"HASH_VERIFIED"' in worker and "content_verified:false" in worker)

require("purchase page discloses trader status", "DreamLedger is in trade in New Zealand" in offer_page)
require("purchase page distinguishes free and paid paths", "free in-browser worksheet" in offer_page and "NZ$49" in offer_page)
require("purchase page discloses automation", "first-pass extraction and comparison are automated" in offer_page)
require("purchase page states data-not-instructions boundary", "treated as untrusted data, not instructions" in offer_page)
require("intake page is noindex private workflow", 'name="robots" content="noindex,nofollow"' in intake_page)
require("intake waits for canonical settlement records", "SETTLEMENT_RECORD_PENDING" in intake_page and "ENTITLEMENT_PENDING" in intake_page)

require("approved offer uses the current link", bool(quote) and quote.get("payment_link_id") == LIVE_LINK_ID and quote.get("payment_link_url") == LIVE_LINK_URL)
require("approved offer is truth_oracle silo", bool(quote) and quote.get("silo") == "truth_oracle")
require("registry points to actual edge functions", reg.get("implementation") == "supabase/functions/quote-intake + supabase/functions/quote-fulfillment")
require("registry does not claim first live delivery proof", reg.get("status") == "AUTOMATED_PATH_DEPLOYED_FIRST_LIVE_DELIVERY_NOT_YET_PROVEN")

require("checkout handler has no literal escaped-newline statements", ";\\n" not in handler)

print(f"\nQUOTE_REVENUE_WEDGE_CONTRACT={'FAIL' if failures else 'PASS'}")
print("LIMITATION=This proves source invariants only. Real external revenue remains unverified until a real buyer pays and receives delivery.")
if failures:
    print("Failed checks: " + ", ".join(failures))
    sys.exit(1)
