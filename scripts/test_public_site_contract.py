#!/usr/bin/env python3
"""Offline contract checks for the public DreamLedger storefront."""
from pathlib import Path
import json
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
SERVER = (ROOT / "public" / "server.js").read_text(encoding="utf-8")
HOME = (ROOT / "public" / "home.html").read_text(encoding="utf-8")
TRUST = (ROOT / "public" / "trust.html").read_text(encoding="utf-8")
ABOUT = (ROOT / "public" / "about.html").read_text(encoding="utf-8")
PUBLIC = ROOT / "public"
MTG = (PUBLIC / "mtg" / "index.html").read_text(encoding="utf-8")
CATALOGUE = json.loads((ROOT / "public" / "catalog.json").read_text(encoding="utf-8"))

BUY_PAGES = list((PUBLIC / "buy").rglob("*.html"))
PRODUCT_PAGES = list((PUBLIC / "products").rglob("*.html"))
ACTIVE_COMMERCE_PAGES = [
    HOME,
    (PUBLIC / "shop.html").read_text(encoding="utf-8"),
    (PUBLIC / "money.html").read_text(encoding="utf-8"),
    (PUBLIC / "billboard.html").read_text(encoding="utf-8"),
    (PUBLIC / "avatar.html").read_text(encoding="utf-8"),
    (PUBLIC / "quote-pilot.html").read_text(encoding="utf-8"),
    MTG,
    *(p.read_text(encoding="utf-8") for p in BUY_PAGES),
    *(p.read_text(encoding="utf-8") for p in PRODUCT_PAGES),
]
DIRECT_STRIPE_URL = re.compile(r"https://(?:buy|checkout)\.stripe\.com/", re.I)
HELD_SKUS = [
    "COMMANDER-DECK-DIAGNOSTIC-001",
    "DREAMLEDGER-BILLBOARD-FOUNDING-001",
    "DISCORD-WEBHOOK-STARTER-KIT-001",
    "SELLER-PROFIT-AUDIT-001",
    "EDH_0001",
]
HELD_PRODUCTS = [
    json.loads((ROOT / "BEC-PRIME" / "catalog" / "products" / f"{sku}.json").read_text(encoding="utf-8"))
    for sku in HELD_SKUS
]

checks = {
    "root maps to designed homepage": "'/':'home.html'" in SERVER,
    "about route maps to page": "'/about/':'about.html'" in SERVER,
    "trust route maps to page": "'/trust/':'trust.html'" in SERVER,
    "MTG route serves the catalog instead of redirecting to itself": "'/mtg/':'mtg/index.html'" in SERVER,
    "homepage has responsive viewport": 'name="viewport"' in HOME,
    "homepage has a free quote worksheet": "quote-tool" in HOME and "comparison-template.csv" in HOME,
    "homepage explains browser-local CSV": "No supplier data is uploaded" in HOME,
    "held diagnostic is visible but non-purchasable": "Commander Deck Diagnostic · NZ$29 · held" in MTG and "Checkout is held" in MTG and "/buy/COMMANDER-DECK-DIAGNOSTIC-001" not in MTG and "buy.stripe.com" not in MTG,
    "trust page defines evidence boundary": "VERIFIED" in TRUST and "UNVERIFIED" in TRUST,
    "about page is present": "DreamLedger" in ABOUT and len(ABOUT) > 1000,
    "no fake customer metrics on homepage": not re.search(r"\b(?:10,000\+ customers|100% uptime|SOC 2 certified|ISO 27001 certified)\b", HOME, re.I),
    "no public secret literals": not re.search(r"(?:sk_live_[A-Za-z0-9]+|whsec_[A-Za-z0-9]+)", HOME + TRUST + ABOUT),
    "active commerce surfaces contain no direct Stripe checkout URLs": not any(DIRECT_STRIPE_URL.search(page) for page in ACTIVE_COMMERCE_PAGES),
    "static buy routes never redirect directly to Stripe": not any(DIRECT_STRIPE_URL.search(page.read_text(encoding="utf-8")) for page in BUY_PAGES),
    "product landing pages have no direct buy route": not any(re.search(r"""href=["\']/buy/""", page.read_text(encoding="utf-8"), re.I) for page in PRODUCT_PAGES),
    "canonical held SKUs have checkout disabled and no payment link": all(
        product.get("status") in {"held", "review_required"}
        and product.get("checkout", {}).get("mode") == "disabled"
        and product.get("checkout", {}).get("url") is None
        and product.get("commercial_truth", {}).get("approval_required") is True
        and product.get("commercial_truth", {}).get("sellable") is False
        and product.get("commercial_truth", {}).get("payment_surface") is None
        and not product.get("commercial_truth", {}).get("payment_link")
        for product in HELD_PRODUCTS
    ),
}

route_keys = set(re.findall(r"""['"](/[^'"]*)['"]\s*:""", SERVER))
internal_links = []
for page in (HOME, TRUST, ABOUT):
    internal_links.extend(re.findall(r"""href=["'](/[^"']*)["']""", page))
broken_links = []
for target in internal_links:
    route = target.split("#", 1)[0].split("?", 1)[0] or "/"
    if route in route_keys:
        continue
    # /buy/<product_id> is a dynamic storefront route. Accept it only when the
    # catalog exposes that exact product as published and checkout-enabled.
    if route.startswith("/buy/") and "p.startsWith('/buy/')" in SERVER:
        product_id = route[len("/buy/"):]
        if any(
            product.get("id") == product_id
            and product.get("status") == "published"
            and product.get("checkout_available") is True
            and isinstance(product.get("checkout_url"), str)
            for product in CATALOGUE.get("products", [])
        ):
            continue
    broken_links.append(target)
checks["internal links map to storefront routes"] = not broken_links

failed = [name for name, ok in checks.items() if not ok]
if broken_links:
    print("BROKEN_INTERNAL_LINKS=" + ", ".join(sorted(set(broken_links))))
for name, ok in checks.items():
    print(f'{"PASS" if ok else "FAIL"} {name}')
print(f"PUBLIC_SITE_CONTRACT={'FAIL' if failed else 'PASS'} checks={len(checks)} failed={len(failed)}")
sys.exit(1 if failed else 0)
