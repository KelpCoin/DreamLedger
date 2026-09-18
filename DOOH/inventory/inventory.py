#!/usr/bin/env python3
"""DOOH inventory management for DreamLedger.

CAPABILITY_PROOF_ONLY. No network. No live Trillboards media buy.
Finite capacity; holds; settle-only sold transition; gated campaign SKUs.
"""
from __future__ import annotations

import argparse
import json
import uuid
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

HERE = Path(__file__).resolve().parent
SEED_PATH = HERE / "inventory_seed.json"

STATES = (
    "AVAILABLE",
    "HELD",
    "SOLD",
    "FULFILLING",
    "COMPLETE",
    "EXPIRED",
    "GATED",
)

DEFAULT_HOLD_MINUTES = 30


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def parse_iso(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


class InventoryError(Exception):
    pass


class DoohInventory:
    """In-memory inventory with optional JSON persistence."""

    def __init__(self, seed: Optional[dict] = None, store_path: Optional[Path] = None):
        self.store_path = Path(store_path) if store_path else None
        self.units: List[dict] = []
        self.skus: Dict[str, dict] = {}
        if seed is None:
            seed = json.loads(SEED_PATH.read_text(encoding="utf-8"))
        self._load_seed(seed)

    def _load_seed(self, seed: dict) -> None:
        for sku_def in seed.get("skus", []):
            sku = sku_def["sku"]
            self.skus[sku] = deepcopy(sku_def)
            capacity = int(sku_def["capacity"])
            gated = bool(sku_def.get("gate")) or not sku_def.get("sellable", True)
            initial = "GATED" if gated else "AVAILABLE"
            for i in range(capacity):
                self.units.append(
                    {
                        "unit_id": f"{sku}:{i + 1:04d}",
                        "sku": sku,
                        "index": i + 1,
                        "state": initial,
                        "holder": None,
                        "hold_expires_at": None,
                        "payment_ref": None,
                        "price_nzd": sku_def.get("price_nzd"),
                        "board": sku_def.get("board"),
                        "tier": sku_def.get("tier"),
                        "gate": sku_def.get("gate"),
                        "updated_at": iso(now_utc()),
                    }
                )

    def expire_holds(self, at: Optional[datetime] = None) -> int:
        at = at or now_utc()
        n = 0
        for u in self.units:
            if u["state"] != "HELD" or not u.get("hold_expires_at"):
                continue
            if parse_iso(u["hold_expires_at"]) <= at:
                u["state"] = "AVAILABLE"
                u["holder"] = None
                u["hold_expires_at"] = None
                u["updated_at"] = iso(at)
                n += 1
        return n

    def summary(self) -> dict:
        self.expire_holds()
        by_sku: Dict[str, dict] = {}
        for u in self.units:
            s = by_sku.setdefault(
                u["sku"],
                {
                    "sku": u["sku"],
                    "AVAILABLE": 0,
                    "HELD": 0,
                    "SOLD": 0,
                    "FULFILLING": 0,
                    "COMPLETE": 0,
                    "EXPIRED": 0,
                    "GATED": 0,
                    "price_nzd": u.get("price_nzd"),
                    "gate": u.get("gate"),
                },
            )
            s[u["state"]] = s.get(u["state"], 0) + 1
        return {
            "schema": "DOOH-INVENTORY-SUMMARY/1.0",
            "revenue_nzd_verified": 0,
            "skus": list(by_sku.values()),
            "total_units": len(self.units),
        }

    def available_count(self, sku: str) -> int:
        self.expire_holds()
        return sum(1 for u in self.units if u["sku"] == sku and u["state"] == "AVAILABLE")

    def reserve(
        self,
        sku: str,
        holder: str,
        hold_minutes: int = DEFAULT_HOLD_MINUTES,
        at: Optional[datetime] = None,
    ) -> dict:
        if not holder:
            raise InventoryError("holder required")
        at = at or now_utc()
        self.expire_holds(at)
        sku_def = self.skus.get(sku)
        if not sku_def:
            raise InventoryError("unknown sku: " + sku)
        if sku_def.get("gate") or not sku_def.get("sellable", True):
            raise InventoryError("sku gated or not sellable: " + sku)
        for u in self.units:
            if u["sku"] == sku and u["state"] == "AVAILABLE":
                u["state"] = "HELD"
                u["holder"] = holder
                u["hold_expires_at"] = iso(at + timedelta(minutes=hold_minutes))
                u["updated_at"] = iso(at)
                return deepcopy(u)
        raise InventoryError("no capacity for sku: " + sku)

    def release(self, unit_id: str, holder: Optional[str] = None) -> dict:
        u = self._get(unit_id)
        if u["state"] != "HELD":
            raise InventoryError("unit not held: " + unit_id)
        if holder is not None and u.get("holder") != holder:
            raise InventoryError("holder mismatch")
        u["state"] = "AVAILABLE"
        u["holder"] = None
        u["hold_expires_at"] = None
        u["updated_at"] = iso(now_utc())
        return deepcopy(u)

    def mark_sold(self, unit_id: str, payment_ref: str, holder: Optional[str] = None) -> dict:
        if not payment_ref:
            raise InventoryError("payment_ref required (settled payment evidence id)")
        u = self._get(unit_id)
        if u["state"] not in ("HELD", "AVAILABLE"):
            raise InventoryError("unit not reservable for sale: " + u["state"])
        if u["state"] == "HELD" and holder is not None and u.get("holder") != holder:
            raise InventoryError("holder mismatch")
        u["state"] = "SOLD"
        u["payment_ref"] = payment_ref
        u["hold_expires_at"] = None
        u["updated_at"] = iso(now_utc())
        return deepcopy(u)

    def mark_fulfilling(self, unit_id: str) -> dict:
        u = self._get(unit_id)
        if u["state"] != "SOLD":
            raise InventoryError("only SOLD units enter fulfillment")
        u["state"] = "FULFILLING"
        u["updated_at"] = iso(now_utc())
        return deepcopy(u)

    def mark_complete(self, unit_id: str) -> dict:
        u = self._get(unit_id)
        if u["state"] != "FULFILLING":
            raise InventoryError("only FULFILLING units complete")
        u["state"] = "COMPLETE"
        u["updated_at"] = iso(now_utc())
        return deepcopy(u)

    def ungate_sku(self, sku: str) -> int:
        """Human operator: open a previously gated SKU for sale."""
        if sku not in self.skus:
            raise InventoryError("unknown sku")
        self.skus[sku]["gate"] = None
        self.skus[sku]["sellable"] = True
        n = 0
        for u in self.units:
            if u["sku"] == sku and u["state"] == "GATED":
                u["state"] = "AVAILABLE"
                u["gate"] = None
                u["updated_at"] = iso(now_utc())
                n += 1
        return n

    def _get(self, unit_id: str) -> dict:
        for u in self.units:
            if u["unit_id"] == unit_id:
                return u
        raise InventoryError("unknown unit_id: " + unit_id)

    def to_dict(self) -> dict:
        return {
            "schema": "DOOH-INVENTORY/1.0",
            "revenue_nzd_verified": 0,
            "skus": self.skus,
            "units": self.units,
        }

    def save(self, path: Optional[Path] = None) -> None:
        path = path or self.store_path
        if not path:
            raise InventoryError("no store_path")
        path.write_text(json.dumps(self.to_dict(), indent=2, sort_keys=True) + "\n", encoding="utf-8")


def main() -> None:
    ap = argparse.ArgumentParser(description="DOOH inventory CLI")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("summary")
    p = sub.add_parser("reserve")
    p.add_argument("--sku", required=True)
    p.add_argument("--holder", required=True)
    p.add_argument("--hold-minutes", type=int, default=DEFAULT_HOLD_MINUTES)
    p = sub.add_parser("release")
    p.add_argument("--unit-id", required=True)
    p.add_argument("--holder", default=None)
    p = sub.add_parser("mark-sold")
    p.add_argument("--unit-id", required=True)
    p.add_argument("--payment-ref", required=True)
    p = sub.add_parser("ungate")
    p.add_argument("--sku", required=True)
    args = ap.parse_args()

    inv = DoohInventory()
    if args.cmd == "summary":
        print(json.dumps(inv.summary(), indent=2))
    elif args.cmd == "reserve":
        print(json.dumps(inv.reserve(args.sku, args.holder, args.hold_minutes), indent=2))
    elif args.cmd == "release":
        print(json.dumps(inv.release(args.unit_id, args.holder), indent=2))
    elif args.cmd == "mark-sold":
        print(json.dumps(inv.mark_sold(args.unit_id, args.payment_ref), indent=2))
    elif args.cmd == "ungate":
        n = inv.ungate_sku(args.sku)
        print(json.dumps({"ungated_units": n, "sku": args.sku}, indent=2))


if __name__ == "__main__":
    main()
