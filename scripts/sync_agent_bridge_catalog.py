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

    # The live toll-road/v2 envelope uses "offers" with checkout_route and
    # execution_route. The older internal snapshot format uses "services" with
    # route and checkout_configured. Accept both explicitly; never reinterpret
    # checkout configuration as settlement or fulfillment evidence.
    entries = manifest.get("services")
    source_collection = "services"
    if not isinstance(entries, list):
        entries = manifest.get("offers")
        source_collection = "offers"

    if not isinstance(entries, list):
        # Preserve the last known catalogue only when neither supported envelope
        # exists. Mark it stale so it cannot be mistaken for a current snapshot.
        if TARGET.exists():
            try:
                previous = json.loads(TARGET.read_text(encoding="utf-8"))
                previous["manifest_sync_status"] = "STALE_PRESERVED"
                previous["manifest_sync_error"] = "services_or_offers_array_missing"
                TARGET.write_text(
                    json.dumps(previous, indent=2, sort_keys=True, ensure_ascii=False) + "\n",
                    encoding="utf-8",
                )
                print("AGENT_BRIDGE_SYNC=STALE_PRESERVED reason=services_or_offers_array_missing")
                return 0
            except (OSError, json.JSONDecodeError):
                pass
        print("AGENT_BRIDGE_SYNC=FAIL services_or_offers_array_missing and no valid prior catalogue", file=sys.stderr)
        return 1

    normalised = []
    seen = set()
    for item in entries:
        if not isinstance(item, dict):
            continue
        service_id = str(item.get("id") or "").strip()
        route = str(item.get("route") or item.get("execution_route") or "").strip()
        # Do not publish a route-less offer as an executable capability.
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
            "description": str(item.get("description") or item.get("scope") or service_id),
            "price_nzd": price,
            "checkout_configured": (
                item.get("checkout_configured") is True
                or bool(str(item.get("checkout_route") or "").strip())
            ),
            "settlement_verified": False,
            "fulfilment_verified": False,
            "lifecycle": "CANDIDATE",
        })

    catalogue = {
        "schema": "dreamledger/agent-bridge-catalog/v1",
        "source_url": SOURCE_URL,
        "manifest_status": str(manifest.get("status") or "UNVERIFIED"),
        "manifest_sync_status": "FRESH",
        "manifest_source_collection": source_collection,
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
