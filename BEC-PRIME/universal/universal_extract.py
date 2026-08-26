#!/usr/bin/env python3
"""Small, dependency-free universal extraction helper.
Reads JSON from stdin and normalizes records into candidate-item-v1.
No network access, browser automation, credential handling, or bypass logic.
"""

import json
import re
import sys
from datetime import datetime, timezone


def now():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def normalize_candidate(raw, source_id):
    raw = raw or {}
    price = raw.get("price")
    shipping = raw.get("shipping")
    try:
        price = float(price) if price is not None else None
    except (TypeError, ValueError):
        price = None
    try:
        shipping = float(shipping) if shipping is not None else None
    except (TypeError, ValueError):
        shipping = None
    return {
        "schema": "candidate-item-v1",
        "platform": source_id,
        "product_id": raw.get("product_id", raw.get("productId", raw.get("id"))),
        "title": raw.get("title"),
        "price": price,
        "currency": raw.get("currency"),
        "product_url": raw.get("product_url", raw.get("url")),
        "image_url": raw.get("image_url", raw.get("image")),
        "seller": raw.get("seller"),
        "condition": raw.get("condition"),
        "shipping": shipping,
        "extracted_at": now(),
    }


def pattern_match(text, patterns):
    text = str(text or "")[:200000]
    result = {}
    for field, pattern in (patterns or {}).items():
        try:
            result[field] = re.findall(str(pattern), text, flags=re.IGNORECASE)[:100]
        except re.error as exc:
            result[field] = []
            print(json.dumps({"event": "pattern_error", "field": field, "error": str(exc)}), file=sys.stderr)
    return result


def main():
    payload = json.load(sys.stdin)
    source = payload.get("source", "unknown")
    records = payload.get("records", payload if isinstance(payload, list) else [])
    if isinstance(records, dict):
        records = [records]
    output = [normalize_candidate(item, source) for item in records]
    print(json.dumps({"schema": "universal-extraction-v1", "count": len(output), "candidates": output}, separators=(",", ":")))


if __name__ == "__main__":
    main()
