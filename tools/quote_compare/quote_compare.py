#!/usr/bin/env python3
"""Deterministic, offline supplier-quote comparator for BECK QUOTE-COMPARE-49.

Input JSON is normalized supplier data extracted by a human or local OCR model.
This module does not invent missing values, fetch external services, or select a
supplier automatically. Unknown costs remain unknown and block a false "cheapest"
claim. Output is stable JSON suitable for review and hash sealing.
"""
from __future__ import annotations
import argparse
import hashlib
import json
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from pathlib import Path

SCHEMA = "beck/quote-compare/1.0"
REQUIRED = ("supplier", "currency", "items")
def money(value):
    if value is None or value == "":
        return None
    try:
        n = Decimal(str(value))
    except InvalidOperation as exc:
        raise ValueError(f"invalid monetary value: {value!r}") from exc
    if not n.is_finite() or n < 0:
        raise ValueError(f"money must be finite and non-negative: {value!r}")
    return n.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
def norm_quote(raw):
    missing = [k for k in REQUIRED if k not in raw]
    if missing:
        raise ValueError("missing required fields: " + ", ".join(missing))
    supplier = str(raw["supplier"]).strip()
    currency = str(raw["currency"]).strip().upper()
    if not supplier or len(supplier) > 160:
        raise ValueError("supplier must be 1..160 characters")
    if len(currency) != 3 or not currency.isalpha() or not currency.isascii():
        raise ValueError("currency must be a three-letter ISO-style code")
    if not isinstance(raw["items"], list) or not raw["items"]:
        raise ValueError("items must be a non-empty list")
    items = []
    subtotal = Decimal("0.00")
    complete = True
    for i, item in enumerate(raw["items"]):
        if not isinstance(item, dict) or not str(item.get("description", "")).strip():
            raise ValueError(f"item {i} requires a description")
        qty = Decimal(str(item.get("quantity", "1")))
        if not qty.is_finite() or qty <= 0:
            raise ValueError(f"item {i} quantity must be positive")
        unit = money(item.get("unit_price"))
        line = (unit * qty).quantize(Decimal("0.01")) if unit is not None else None
        if line is None:
            complete = False
        else:
            subtotal += line
        items.append({
            "description": str(item["description"]).strip()[:300],
            "quantity": str(qty.normalize()),
            "unit_price": str(unit) if unit is not None else None,
            "line_total": str(line) if line is not None else None,
            "evidence_ref": str(item.get("evidence_ref", ""))[:200] or None
        })
    freight = money(raw.get("freight"))
    tax = money(raw.get("tax"))
    other = money(raw.get("other_fees"))
    if any(v is None for v in (freight, tax, other)):
        complete = False
    known_total = subtotal + sum((v for v in (freight, tax, other) if v is not None), Decimal("0.00"))
    return {
        "supplier": supplier, "currency": currency,
        "quote_reference": str(raw.get("quote_reference", ""))[:120] or None,
        "valid_until": str(raw.get("valid_until", ""))[:40] or None,
        "lead_time_days": raw.get("lead_time_days"),
        "items": items, "subtotal_known": str(subtotal),
        "freight": str(freight) if freight is not None else None,
        "tax": str(tax) if tax is not None else None,
        "other_fees": str(other) if other is not None else None,
        "known_cost_total": str(known_total),
        "total_complete": complete,
        "assumptions": sorted(set(str(x)[:240] for x in raw.get("assumptions", []))),
        "exclusions": sorted(set(str(x)[:240] for x in raw.get("exclusions", []))),
        "source_file_sha256": raw.get("source_file_sha256")
    }
def compare(raw_quotes):
    quotes = [norm_quote(q) for q in raw_quotes]
    currencies = sorted(set(q["currency"] for q in quotes))
    comparable = len(currencies) == 1 and all(q["total_complete"] for q in quotes)
    ranked = sorted(quotes, key=lambda q: (Decimal(q["known_cost_total"]), q["supplier"].casefold()))
    for rank, q in enumerate(ranked, 1):
        q["known_cost_rank"] = rank if len(currencies) == 1 else None
    return {
        "schema": SCHEMA, "mode": "offline_deterministic",
        "quote_count": len(quotes), "currencies": currencies,
        "fully_comparable": comparable,
        "lowest_known_cost_supplier": ranked[0]["supplier"] if comparable and ranked else None,
        "warning": None if comparable else "No cheapest-supplier conclusion: currencies differ or at least one quote has missing cost fields.",
        "quotes": ranked
    }
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("input", type=Path)
    ap.add_argument("--output", type=Path)
    args = ap.parse_args()
    raw = json.loads(args.input.read_text(encoding="utf-8"))
    result = compare(raw if isinstance(raw, list) else raw.get("quotes", []))
    canonical = json.dumps(result, ensure_ascii=True, sort_keys=True, separators=(",", ":"))
    result["output_sha256"] = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    rendered = json.dumps(result, ensure_ascii=True, indent=2) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered, encoding="utf-8", newline="\n")
    else:
        print(rendered, end="")
if __name__ == "__main__":
    main()
