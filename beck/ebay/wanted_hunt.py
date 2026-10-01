import base64
import hashlib
import json
import os
import re
import time
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List

import requests

from beck.core.models import Candidate, Wanted

BASE_URL = "https://api.ebay.com/buy/browse/v1"
TOKEN_URL = "https://api.ebay.com/identity/v1/oauth2/token"
MARKETPLACE = os.getenv("EBAY_MARKETPLACE", "EBAY_AU")


def utc_now():
    return datetime.now(timezone.utc).isoformat()


def parse_wanted(text: str) -> Wanted:
    price = re.search(r"(?:NZ\$|\$)\s*(\d+(?:\.\d{1,2})?)", text, re.I)
    sizes = sorted(set(x.upper() for x in re.findall(r"\b(2XL|XXL|XL|L|M|S|XS)\b", text, re.I)))
    brands = sorted(set(x.upper() for x in re.findall(r"\b(FUBU|NIKE|ADIDAS|LEVI'?S?)\b", text, re.I)))
    colours = sorted(set(x.lower() for x in re.findall(r"\b(black|red|blue|white|denim)\b", text, re.I)))
    era = sorted(set(x.lower() for x in re.findall(r"\b(1990s|2000s|vintage|retro|90s|00s)\b", text, re.I)))
    category = ["jacket"] if re.search(r"\b(jacket|coat)\b", text, re.I) else []
    return Wanted(f"wanted_{uuid.uuid4().hex[:12]}", text, brands, category, sizes, colours, era, Decimal(price.group(1)) if price else None)


def get_token(app_id: str, cert_id: str) -> str:
    auth = base64.b64encode(f"{app_id}:{cert_id}".encode()).decode()
    response = requests.post(TOKEN_URL, headers={"Authorization": f"Basic {auth}", "Content-Type": "application/x-www-form-urlencoded"}, data={"grant_type": "client_credentials", "scope": "https://api.ebay.com/oauth/api_scope"}, timeout=30)
    response.raise_for_status()
    return response.json()["access_token"]


def search(wanted: Wanted, token: str) -> Dict[str, Any]:
    query = " ".join(wanted.brand + wanted.category + wanted.sizes + wanted.colours + wanted.era) or "item"
    filters = ["buyingOptions:{FIXED_PRICE}", f"deliveryCountry:{wanted.destination_country}"]
    if wanted.max_price_nzd is not None:
        filters.append(f"price:[..{wanted.max_price_nzd}],priceCurrency:NZD")
    params = {"q": query, "limit": 20, "filter": ",".join(filters)}
    headers = {"Authorization": f"Bearer {token}", "Accept-Language": "en-AU", "X-EBAY-C-MARKETPLACE-ID": MARKETPLACE}
    started = time.time()
    response = requests.get(f"{BASE_URL}/item_summary/search", headers=headers, params=params, timeout=20)
    raw_body = response.text
    parsed = response.json() if response.ok else {}
    canonical_response = json.dumps(parsed, sort_keys=True, separators=(",", ":"))
    return {"status_code": response.status_code, "duration_ms": int((time.time() - started) * 1000), "request": {"method": "GET", "endpoint": f"{BASE_URL}/item_summary/search", "params": params}, "response_sha256": hashlib.sha256(canonical_response.encode()).hexdigest(), "data": parsed}


def score(item: Dict[str, Any], wanted: Wanted) -> Candidate:
    price = item.get("price") or {}
    amount = Decimal(str(price["value"])) if price.get("value") is not None else None
    currency = price.get("currency")
    title = (item.get("title") or "").lower()
    dimensions = {
        "brand": 1.0 if wanted.brand and any(x.lower() in title for x in wanted.brand) else (0.5 if not wanted.brand else 0.0),
        "category": 1.0 if wanted.category and any(x.lower() in title for x in wanted.category) else (0.5 if not wanted.category else 0.0),
        "size": 1.0 if wanted.sizes and any(re.search(rf"(?<![A-Za-z0-9]){re.escape(x.lower())}(?![A-Za-z0-9])", title) for x in wanted.sizes) else (0.5 if not wanted.sizes else 0.0),
        "colour": 1.0 if wanted.colours and any(x.lower() in title for x in wanted.colours) else (0.5 if not wanted.colours else 0.0),
        "era": 1.0 if wanted.era and any(x.lower() in title for x in wanted.era) else (0.5 if not wanted.era else 0.0),
        "price": 1.0 if amount is not None and wanted.max_price_nzd is not None and currency == "NZD" and amount <= wanted.max_price_nzd else 0.0,
    }
    weights = {"brand": .25, "category": .15, "size": .20, "colour": .10, "era": .10, "price": .20}
    total = round(sum(dimensions[k] * weights[k] for k in weights), 3)
    verdict = "STRONG" if total >= .8 else "POSSIBLE" if total >= .6 else "WEAK"
    return Candidate(item.get("itemId", ""), item.get("itemWebUrl", ""), item.get("title", ""), amount, currency, None, None, item.get("condition"), item.get("seller", {}), item, dimensions, total, verdict)


def build_proof(wanted: Wanted, result: Dict[str, Any], candidates: List[Candidate]) -> Dict[str, Any]:
    proof = {
        "schema_version": "2.0",
        "proof_type": "EBAY_WANTED_HUNT",
        "run_id": str(uuid.uuid4()),
        "created_at": utc_now(),
        "wanted": wanted.to_dict(),
        "source": {"platform": "eBay Browse API", "marketplace": MARKETPLACE, "request": result["request"], "http_status": result["status_code"], "duration_ms": result["duration_ms"], "response_sha256": result["response_sha256"], "raw_response": result["data"]},
        "candidates": [c.to_dict() for c in candidates],
        "gates": {"G01_CREDENTIALS_PRESENT": "PASS", "G02_OAUTH_SUCCESS": "PASS", "G03_HTTP_SUCCESS": "PASS" if result["status_code"] == 200 else "FAIL", "G04_RESPONSE_HASHED": "PASS" if result["response_sha256"] else "FAIL", "G05_RESULTS_RETURNED": "PASS" if candidates else "FAIL", "G06_STRONG_MATCH": "PASS" if any(c.verdict == "STRONG" for c in candidates) else "FAIL"},
        "commercial_signal": "UNPROVEN",
    }
    proof["proof_sha256"] = hashlib.sha256(json.dumps(proof, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    return proof


def run():
    app_id, cert_id = os.getenv("EBAY_APP_ID"), os.getenv("EBAY_CERT_ID")
    if not app_id or not cert_id:
        raise RuntimeError("EBAY_APP_ID and EBAY_CERT_ID are required and are never written to proof.")
    wanted = parse_wanted(os.getenv("BECK_WANTED_TEXT", "I want a FUBU jacket, XL or 2XL, vintage 1990s/2000s, black or red, under NZ$120"))
    token = get_token(app_id, cert_id)
    result = search(wanted, token)
    if result["status_code"] != 200:
        raise RuntimeError(f"eBay Browse API returned HTTP {result['status_code']}")
    items = result["data"].get("itemSummaries", [])
    candidates = sorted((score(item, wanted) for item in items), key=lambda x: x.total_score, reverse=True)
    proof = build_proof(wanted, result, candidates)
    path = os.getenv("BECK_PROOF_PATH", "proof/ebay/latest-wanted-hunt-proof.json")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(proof, handle, indent=2)
        handle.write("\n")
    print(json.dumps({"proof_file": path, "strong_match": proof["gates"]["G06_STRONG_MATCH"], "candidates": len(candidates), "proof_sha256": proof["proof_sha256"]}, indent=2))


if __name__ == "__main__":
    run()
