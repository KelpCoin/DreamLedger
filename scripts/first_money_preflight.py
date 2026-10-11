#!/usr/bin/env python3
"""Read-only first-money preflight for DreamLedger.

This script reports observations only. It never creates checkout sessions, charges a
card, redeems an entitlement, writes to Supabase, changes Windows settings, or prints
secret values. Run from the repository root with Python 3.10+.
"""
from __future__ import annotations

import json
import os
import socket
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
POOLER_HOST = os.getenv(
    "SUPABASE_POOLER_HOST",
    "aws-0-ap-southeast-1.pooler.supabase.com",
)
POOLER_PORT = int(os.getenv("SUPABASE_POOLER_PORT", "6543"))
GATEWAY_BASE = os.getenv(
    "DREAMLEDGER_GATEWAY_BASE",
    "https://dreamledger-silo-gateway.onrender.com",
).rstrip("/")
MANIFEST_PATH = "/api/toll/v1/manifest"
LM_MODELS_URL = os.getenv("LM_STUDIO_MODELS_URL", "http://127.0.0.1:1234/v1/models")

# Check the canonical implementation locations actually used by DreamLedger.
# Old filenames such as scripts/toll_road_checker.py and scripts/ingest_quote.py
# are not canonical entry points and must not create false missing-file failures.
SOURCE_FILES = (
    "public/server.js",
    "BEC-PRIME/routes/tollRoad.js",
    "BEC-PRIME/runtime/TollRoad.js",
    "BEC-PRIME/scripts/test-toll-probe-single-use.js",
    "supabase/functions/quote-intake/index.ts",
    "supabase/functions/quote-fulfillment/index.ts",
)
RESULTS: list[dict[str, Any]] = []


def record(name: str, status: str, detail: str) -> None:
    RESULTS.append({"check": name, "status": status, "detail": detail})


def tcp_check(host: str, port: int, timeout: float = 4.0) -> None:
    try:
        with socket.create_connection((host, port), timeout=timeout):
            record("supabase_transaction_pooler_tcp", "PASS", f"TCP connection to {host}:{port} succeeded")
    except Exception as exc:
        record(
            "supabase_transaction_pooler_tcp",
            "FAIL",
            f"TCP connection to {host}:{port} failed: {type(exc).__name__}: {exc}",
        )


def http_get(name: str, url: str, timeout: float = 8.0) -> None:
    request = urllib.request.Request(url, headers={"User-Agent": "DreamLedger-readonly-preflight/1.1"})
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            payload = response.read(256_000)
            record(name, "PASS" if 200 <= response.status < 300 else "FAIL",
                   f"HTTP {response.status}; received {len(payload)} bytes from {url}")
            if name == "gateway_manifest":
                try:
                    manifest = json.loads(payload.decode("utf-8"))
                    text = json.dumps(manifest, ensure_ascii=False).lower()
                    for marker in ("toll-probe-50c", "agent-bridge-events-100"):
                        record(
                            f"manifest_contains_{marker}",
                            "OBSERVED" if marker in text else "NOT_FOUND",
                            "Marker appears in returned manifest" if marker in text else "Marker not found in returned manifest",
                        )
                except Exception as exc:
                    record("gateway_manifest_json", "FAIL", f"Response was not valid JSON: {type(exc).__name__}")
    except urllib.error.HTTPError as exc:
        record(name, "FAIL", f"HTTP {exc.code} from {url}")
    except Exception as exc:
        record(name, "FAIL", f"{type(exc).__name__}: {exc} for {url}")


def check_source_files() -> None:
    for relative in SOURCE_FILES:
        path = ROOT / relative
        record(
            f"source_file:{relative}",
            "PRESENT" if path.is_file() else "MISSING",
            "Canonical source file exists" if path.is_file() else "Canonical source file is absent at this repository path",
        )


def check_local_model_server() -> None:
    http_get("lm_studio_models_endpoint", LM_MODELS_URL, timeout=2.0)


def main() -> int:
    record("repository_root", "OBSERVED", str(ROOT))
    record("secrets_policy", "PASS", "Secret values are not read or printed by this script")
    tcp_check(POOLER_HOST, POOLER_PORT)
    http_get("gateway_manifest", GATEWAY_BASE + MANIFEST_PATH)
    check_source_files()
    check_local_model_server()

    # Source presence and network reachability are not behavioral proof.
    record("atomic_quota_decrement", "UNVERIFIED",
           "Requires concurrent/replay tests against the actual entitlement handler and persistence layer")
    record("duplicate_entitlement_prevention", "UNVERIFIED",
           "Requires repeated checkout-session redemption tests and authoritative entitlement reads")
    record("quote_ingestion_pii_redaction_and_sha256", "UNVERIFIED",
           "A quote-intake Edge Function exists in source; privacy/hash guarantees still require source audit and non-sensitive fixture tests")
    record("settlement_to_fulfillment", "UNVERIFIED",
           "Requires an independent settled payment, scoped entitlement, successful execution, receipt, and reconciliation")

    output = {"tool": "dreamledger-first-money-preflight", "mode": "READ_ONLY", "results": RESULTS}
    print(json.dumps(output, indent=2, ensure_ascii=False))
    failures = sum(1 for item in RESULTS if item["status"] == "FAIL")
    missing = sum(1 for item in RESULTS if item["status"] == "MISSING")
    return 1 if failures or missing else 0


if __name__ == "__main__":
    sys.exit(main())
