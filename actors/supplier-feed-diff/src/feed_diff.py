from __future__ import annotations
import csv
import hashlib
import io
import json
from decimal import Decimal, InvalidOperation
from typing import Any

MAX_ROWS_HARD = 50_000
MAX_INPUT_BYTES_HARD = 5 * 1024 * 1024

class FeedValidationError(ValueError):
    pass

def sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()

def parse_csv_snapshot(raw: str, *, label: str, max_rows: int, max_input_bytes: int) -> list[dict[str, str]]:
    if not isinstance(raw, str) or not raw.strip():
        raise FeedValidationError(f"{label} CSV must be a non-empty string")
    if len(raw.encode("utf-8")) > min(max_input_bytes, MAX_INPUT_BYTES_HARD):
        raise FeedValidationError(f"{label} CSV exceeds the input byte limit")
    try:
        reader = csv.DictReader(io.StringIO(raw, newline=""))
        if not reader.fieldnames:
            raise FeedValidationError(f"{label} CSV has no header")
        headers = [h.strip() for h in reader.fieldnames if h is not None]
        if len(headers) != len(set(headers)):
            raise FeedValidationError(f"{label} CSV has duplicate header names")
        rows: list[dict[str, str]] = []
        for line_no, raw_row in enumerate(reader, start=2):
            if line_no - 1 > min(max_rows, MAX_ROWS_HARD):
                raise FeedValidationError(f"{label} CSV exceeds the row limit")
            if None in raw_row:
                raise FeedValidationError(f"{label} CSV row {line_no} has more values than headers")
            row = {str(k).strip(): (v or "").strip() for k, v in raw_row.items() if k is not None}
            if not any(row.values()):
                continue
            rows.append(row)
        return rows
    except csv.Error as exc:
        raise FeedValidationError(f"{label} CSV parse error: {exc}") from exc

def _index(rows: list[dict[str, str]], *, sku_field: str, label: str) -> tuple[dict[str, dict[str, str]], list[str]]:
    by_sku: dict[str, dict[str, str]] = {}
    duplicates: list[str] = []
    seen: set[str] = set()
    for row in rows:
        sku = row.get(sku_field, "").strip()
        if not sku:
            raise FeedValidationError(f"{label} contains a row with a blank SKU")
        if sku in seen:
            duplicates.append(sku)
        seen.add(sku)
        if sku not in by_sku:
            by_sku[sku] = row
    return by_sku, sorted(set(duplicates))

def _price(value: str, *, label: str, sku: str) -> Decimal:
    try:
        number = Decimal(value.strip())
    except (InvalidOperation, AttributeError):
        raise FeedValidationError(f"{label} SKU {sku!r} has invalid price {value!r}")
    if not number.is_finite() or number < 0:
        raise FeedValidationError(f"{label} SKU {sku!r} price must be finite and non-negative")
    return number

def compare_snapshots(
    baseline_rows: list[dict[str, str]], current_rows: list[dict[str, str]], *,
    sku_field: str = "sku", price_field: str = "price", currency_field: str = "currency",
) -> dict[str, Any]:
    for field in (sku_field, price_field, currency_field):
        if not isinstance(field, str) or not field:
            raise FeedValidationError("SKU, price and currency field names must be non-empty strings")
        if any(field not in row for row in baseline_rows + current_rows):
            raise FeedValidationError(f"Required field {field!r} is missing from one or both CSV snapshots")
    base, base_duplicates = _index(baseline_rows, sku_field=sku_field, label="Baseline")
    curr, curr_duplicates = _index(current_rows, sku_field=sku_field, label="Current snapshot")
    duplicate_skus = sorted(set(base_duplicates + curr_duplicates))
    unsafe = set(duplicate_skus)
    rows: list[dict[str, Any]] = []
    for sku in sorted(set(base) | set(curr)):
        old, new = base.get(sku), curr.get(sku)
        if sku in unsafe:
            rows.append({"sku": sku, "status": "DUPLICATE_SKU_REVIEW", "baseline_price": None, "current_price": None, "currency": None, "delta": None, "delta_percent": None})
            continue
        if old is None:
            currency = new[currency_field].strip().upper()
            price = _price(new[price_field], label="Current", sku=sku)
            if not currency:
                raise FeedValidationError(f"Current SKU {sku!r} has a blank currency")
            rows.append({"sku": sku, "status": "NEW_SKU", "baseline_price": None, "current_price": str(price), "currency": currency, "delta": None, "delta_percent": None})
            continue
        if new is None:
            currency = old[currency_field].strip().upper()
            price = _price(old[price_field], label="Baseline", sku=sku)
            if not currency:
                raise FeedValidationError(f"Baseline SKU {sku!r} has a blank currency")
            rows.append({"sku": sku, "status": "REMOVED_SKU", "baseline_price": str(price), "current_price": None, "currency": currency, "delta": None, "delta_percent": None})
            continue
        old_currency, new_currency = old[currency_field].strip().upper(), new[currency_field].strip().upper()
        old_price = _price(old[price_field], label="Baseline", sku=sku)
        new_price = _price(new[price_field], label="Current", sku=sku)
        if not old_currency or not new_currency:
            raise FeedValidationError(f"SKU {sku!r} has a blank currency")
        if old_currency != new_currency:
            rows.append({"sku": sku, "status": "CURRENCY_CHANGED_REVIEW", "baseline_price": str(old_price), "current_price": str(new_price), "currency": None, "baseline_currency": old_currency, "current_currency": new_currency, "delta": None, "delta_percent": None})
            continue
        delta = new_price - old_price
        status = "UNCHANGED" if delta == 0 else "PRICE_CHANGED"
        pct = None if old_price == 0 else ("0" if delta == 0 else str((delta / old_price * Decimal(100)).quantize(Decimal("0.01"))))
        rows.append({"sku": sku, "status": status, "baseline_price": str(old_price), "current_price": str(new_price), "currency": old_currency, "delta": str(delta), "delta_percent": pct})
    counts: dict[str, int] = {}
    for row in rows:
        counts[row["status"]] = counts.get(row["status"], 0) + 1
    return {
        "schema": "dreamledger.supplier-feed-diff.v1",
        "status": "REVIEW_REQUIRED" if duplicate_skus or any(r["status"] == "CURRENCY_CHANGED_REVIEW" for r in rows) else "COMPLETED",
        "baseline_rows": len(baseline_rows),
        "current_rows": len(current_rows),
        "matched_unique_skus": len(set(base) & set(curr)) - len(unsafe & set(base) & set(curr)),
        "duplicate_skus": duplicate_skus,
        "counts_by_status": counts,
        "rows": rows,
        "policy": {
            "network_access": "NONE",
            "external_write_actions": "NONE",
            "duplicate_skus": "flagged; no automatic winner selected",
            "cross_currency_delta": "suppressed; manual review required",
            "zero_baseline_percent": "undefined; delta percent suppressed"
        }
    }

def compare_csv_texts(baseline_csv: str, current_csv: str, *, max_rows: int = 10000, max_input_bytes: int = 2000000, sku_field: str = "sku", price_field: str = "price", currency_field: str = "currency") -> dict[str, Any]:
    baseline = parse_csv_snapshot(baseline_csv, label="Baseline", max_rows=max_rows, max_input_bytes=max_input_bytes)
    current = parse_csv_snapshot(current_csv, label="Current snapshot", max_rows=max_rows, max_input_bytes=max_input_bytes)
    result = compare_snapshots(baseline, current, sku_field=sku_field, price_field=price_field, currency_field=currency_field)
    result["input_hashes"] = {"baseline_sha256": sha256_text(baseline_csv), "current_sha256": sha256_text(current_csv)}
    result["comparison_idempotency_key"] = sha256_text(json.dumps({
        "baseline": result["input_hashes"]["baseline_sha256"],
        "current": result["input_hashes"]["current_sha256"],
        "sku_field": sku_field, "price_field": price_field, "currency_field": currency_field
    }, sort_keys=True))
    return result
