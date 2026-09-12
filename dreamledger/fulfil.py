"""Settlement-gated fulfilment and proof writer."""
from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from . import ledger

FULFILMENT_DIR = Path("dreamledger/fulfilments")


def record_fulfilment(*, order_id: str, sku: str, amount_cents: int, currency: str, buyer_reference: str, deliverable_text: str, delivery_channel: str, time_taken_minutes: int, notes: str = "") -> dict[str, Any]:
    if not order_id or not sku or amount_cents <= 0 or not currency or not buyer_reference:
        raise ValueError("order, sku, positive amount, currency, and buyer reference are required")
    FULFILMENT_DIR.mkdir(parents=True, exist_ok=True)
    now = datetime.now(timezone.utc).isoformat()
    deliverable_hash = hashlib.sha256(deliverable_text.encode("utf-8")).hexdigest()
    proof_input = "|".join([order_id, sku, str(amount_cents), currency.lower(), buyer_reference, deliverable_hash])
    proof_hash = hashlib.sha256(proof_input.encode("utf-8")).hexdigest()
    record = {"order_id": order_id, "sku": sku, "amount_cents": amount_cents, "currency": currency.lower(), "buyer_reference": buyer_reference, "deliverable_hash": deliverable_hash, "proof_hash": proof_hash, "delivery_channel": delivery_channel, "time_taken_minutes": time_taken_minutes, "fulfilled_at": now, "notes": notes}
    path = FULFILMENT_DIR / f"{order_id}.json"
    if path.exists():
        raise FileExistsError(f"fulfilment already recorded: {order_id}")
    path.write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
    ledger.record("fulfilment.completed", record)
    return record
