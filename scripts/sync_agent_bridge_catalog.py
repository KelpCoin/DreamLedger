#!/usr/bin/env python3
"""Refresh the same-origin Agent Bridge catalogue snapshot for the public marketplace.

The source manifest is authoritative for declared capabilities and listed prices only.
It does not prove settlement, entitlement, fulfilment, buyer demand, or revenue.
The output is stable: no per-run timestamp is written, so unchanged manifests do not
cause repeated commits or redeploys.
"""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "agent-bridge-catalog.json"
SOURCE_URL = os.environ.get(
    "AGENT_BRIDGE_MANIFEST_URL",
    "https://dreamledger-silo-gateway.onrender.com/api/toll/v1/manifest",
)


def main() -> int:
    request = urllib.request.Request(
        SOURCE_URL,
        headers={"Accept": "application/json", "User-Agent": "DreamLedger-777-CatalogSync/1.0"},
    )
    try:
        with urllib.request.urlopen(request, timeout=12) as response:
            raw = response.read(2_000_000).decode("utf-8")
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        if TARGET.exists():
            print(f"AGENT_BRIDGE_SYNC=STALE_PRESERVED reason={type(exc).__name__}")
            return 0
        print(f"AGENT_BRIDGE_SYNC=FAIL reason={type(exc).__name__}", file=sys.stderr)
        return 1

    # Defensive normalisation for an upstream serializer that escapes underscores.
    raw = raw.replace("\\_", "_")
    try:
        manifest = json.loads(raw)
    except json.JSONDecodeError as exc:
        print(f"AGENT_BRIDGE_SYNC=FAIL invalid_json line={exc.lineno}", file=sys.stderr)
        return 1

    services = manifest.get("services")
    if not isinstance(services, list):
        print("AGENT_BRIDGE_SYNC=FAIL services_array_missing", file=sys.stderr)
        return 1

    normalised = []
    seen = set()
    for item in services:
        if not isinstance(item, dict):
            continue
        service_id = str(item.get("id") or "").strip()
        route = str(item.get("route") or "").strip()
        if not service_id or not route or service_id in seen:
            continue
        seen.add(service_id)
        price = item.get("price_nzd")
        try:
            price = float(price) if price is not None else None
        except (TypeError, ValueError):
            price = None
        normalised.append({
            "id": service_id,
            "route": route,
            "scope": str(item.get("scope") or ""),
            "description": str(item.get("description") or ""),
            "price_nzd": price,
            "checkout_configured": item.get("checkout_configured") is True,
            "settlement_verified": False,
            "fulfilment_verified": False,
            "lifecycle": "CANDIDATE",
        })

    catalogue = {
        "schema": "dreamledger/agent-bridge-catalog/v1",
        "source_url": SOURCE_URL,
        "manifest_status": str(manifest.get("status") or "UNVERIFIED"),
        "design_target_roads": manifest.get("design_target_roads"),
        "service_count": len(normalised),
        "services": sorted(normalised, key=lambda row: row["id"]),
        "truth_boundary": (
            "Manifest presence and checkout configuration are not proof of settlement, "
            "entitlement, fulfilment, independent buyers, or revenue."
        ),
    }
    rendered = json.dumps(catalogue, indent=2, sort_keys=True, ensure_ascii=False) + "\n"
    if TARGET.exists() and TARGET.read_text(encoding="utf-8") == rendered:
        print(f"AGENT_BRIDGE_SYNC=UNCHANGED services={len(normalised)}")
        return 0
    TARGET.write_text(rendered, encoding="utf-8")
    print(f"AGENT_BRIDGE_SYNC=UPDATED services={len(normalised)} target={TARGET.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
