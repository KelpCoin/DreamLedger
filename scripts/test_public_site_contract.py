#!/usr/bin/env python3
"""Offline contract checks for the public DreamLedger storefront."""
from pathlib import Path
import json
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
SERVER = (ROOT / "public" / "server.js").read_text(encoding="utf-8")
HOME = (ROOT / "public" / "index.html").read_text(encoding="utf-8")
TRUST = (ROOT / "public" / "trust.html").read_text(encoding="utf-8")
ABOUT = (ROOT / "public" / "about.html").read_text(encoding="utf-8")
CATALOGUE = json.loads((ROOT / "public" / "catalog.json").read_text(encoding="utf-8"))

checks = {
    "root maps to designed homepage": "'/':'index.html'" in SERVER,
    "about route maps to page": "'/about/':'about.html'" in SERVER,
    "trust route maps to page": "'/trust/':'trust.html'" in SERVER,
    "homepage has responsive viewport": 'name="viewport"' in HOME,
    "homepage has a free quote worksheet": "quote-tool" in HOME and "comparison-template.csv" in HOME,
    "homepage explains browser-local CSV": "No supplier data was uploaded" in HOME,
    "trust page defines evidence boundary": "VERIFIED" in TRUST and "UNVERIFIED" in TRUST,
    "about page is present": "DreamLedger" in ABOUT and len(ABOUT) > 1000,
    "no fake customer metrics on homepage": not re.search(r"\b(?:10,000\+ customers|100% uptime|SOC 2 certified|ISO 27001 certified)\b", HOME, re.I),
    "no public secret literals": not re.search(r"(?:sk_live_[A-Za-z0-9]+|whsec_[A-Za-z0-9]+)", HOME + TRUST + ABOUT),
}

route_keys = set(re.findall(r"""['"](/[^'"]*)['"]\s*:""", SERVER))
internal_links = []
for page in (HOME, TRUST, ABOUT):
    internal_links.extend(re.findall(r"""href=["'](/[^"']*)["']""", page))
broken_links = []
for target in internal_links:
    route = target.split("#", 1)[0].split("?", 1)[0] or "/"
    if route in route_keys or (ROOT / "public" / route.lstrip("/")).is_file() or (ROOT / "public" / route.lstrip("/") / "index.html").is_file():
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
