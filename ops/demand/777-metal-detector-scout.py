#!/usr/bin/env python3
"""777 Metal-Detector Scout: harvest and durably stage raw public-source findings.

This component never classifies, scores, filters, publishes, spends, or writes economic_ledger.
Every returned source item is preserved as raw JSON. Source failures are recorded per run.
"""
from __future__ import annotations
import hashlib
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

DEFAULT_SUPABASE = "https://wbwgroygjeyukkspnqiy.supabase.co"
SOURCES = [
    ("mcp_registry", "https://registry.modelcontextprotocol.io/v0/servers"),
    ("remoteok", "https://remoteok.com/api"),
    ("arbeitnow", "https://www.arbeitnow.com/api/job-board-api"),
]
MAX_BYTES = 12_000_000
TIMEOUT_SECONDS = 25


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def canonical_json(value) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), default=str)


def sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def request_json(url: str, headers: dict | None = None):
    req = urllib.request.Request(url, headers={
        "User-Agent": "DreamLedger-777-MetalDetector/1.0 (+https://dreamledger.org)",
        "Accept": "application/json",
        **(headers or {}),
    })
    with urllib.request.urlopen(req, timeout=TIMEOUT_SECONDS) as response:
        body = response.read(MAX_BYTES + 1)
        if len(body) > MAX_BYTES:
            raise ValueError("SOURCE_RESPONSE_TOO_LARGE")
        if response.status < 200 or response.status >= 300:
            raise RuntimeError(f"SOURCE_HTTP_{response.status}")
    return json.loads(body.decode("utf-8"))


def extract_items(source: str, payload):
    # Do not rank or discard items here. This is a shape adapter, not a filter.
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        for key in ("servers", "data", "results", "items"):
            value = payload.get(key)
            if isinstance(value, list):
                return value
        # Preserve an unrecognized object as a single raw find instead of dropping it.
        return [payload]
    return [{"raw_value": payload}]


def item_url(item) -> str | None:
    if not isinstance(item, dict):
        return None
    for key in ("url", "html_url", "website", "job_url", "link", "repository_url"):
        value = item.get(key)
        if isinstance(value, str) and value.startswith(("https://", "http://")):
            return value[:2000]
    nested = item.get("repository")
    if isinstance(nested, dict):
        value = nested.get("url") or nested.get("html_url")
        if isinstance(value, str) and value.startswith(("https://", "http://")):
            return value[:2000]
    return None


def supabase_request(base: str, key: str, path: str, method="GET", body=None, prefer=None):
    url = base.rstrip("/") + "/rest/v1/" + path.lstrip("/")
    headers = {
        "apikey": key,
        "Authorization": "Bearer " + key,
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    if prefer:
        headers["Prefer"] = prefer
    data = None if body is None else json.dumps(body, separators=(",", ":")).encode("utf-8")
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    with urllib.request.urlopen(req, timeout=TIMEOUT_SECONDS) as response:
        raw = response.read(MAX_BYTES + 1)
        if len(raw) > MAX_BYTES:
            raise ValueError("SUPABASE_RESPONSE_TOO_LARGE")
        decoded = raw.decode("utf-8", "replace")
        if response.status < 200 or response.status >= 300:
            raise RuntimeError(f"SUPABASE_HTTP_{response.status}:{decoded[:400]}")
        return json.loads(decoded) if decoded.strip() else None


def main() -> int:
    if os.environ.get("SCOUT_DRY_RUN") == "1":
        print(json.dumps({"mode": "DRY_RUN", "sources": [x[0] for x in SOURCES],
                          "note": "No network writes performed."}, indent=2))
        return 0
    base = os.environ.get("SUPABASE_URL", DEFAULT_SUPABASE).rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_SECRET_KEY")
    if not key:
        print("SCOUT_BLOCKED=MISSING_SUPABASE_SERVER_CREDENTIAL", file=sys.stderr)
        return 2

    x402_url = os.environ.get("SCOUT_X402_FEED_URL", "").strip()
    sources = list(SOURCES)
    if x402_url:
        if not x402_url.startswith("https://"):
            print("SCOUT_X402=SKIPPED_NON_HTTPS_URL", file=sys.stderr)
        else:
            sources.append(("x402_tasks", x402_url))

    run_key = "777-metal-detector-" + datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S") + "-" + str(os.environ.get("GITHUB_RUN_ID", "manual"))
    run = supabase_request(base, key, "scout_runs", "POST", {
        "run_key": run_key,
        "trigger_source": os.environ.get("GITHUB_EVENT_NAME", "manual"),
        "status": "RUNNING",
        "source_results": {},
    }, "return=representation")
    if not isinstance(run, list) or not run or not run[0].get("id"):
        raise RuntimeError("SCOUT_RUN_RECEIPT_NOT_CREATED")
    run_id = run[0]["id"]

    result = {"run_id": run_id, "run_key": run_key, "started_at": utc_now(),
              "sources": {}, "harvested_count": 0, "error_count": 0}
    for source, url in sources:
        started = time.monotonic()
        try:
            payload = request_json(url)
            items = extract_items(source, payload)
            staged = 0
            for item in items:
                raw_text = canonical_json(item)
                digest = sha256(raw_text)
                row = {
                    "source": source,
                    "payload_sha256": digest,
                    "canonical_url": item_url(item),
                    "raw_payload": item if isinstance(item, (dict, list, str, int, float, bool)) or item is None else {"value": str(item)},
                    "status": "STAGED",
                    "last_seen_at": utc_now(),
                    "last_run_id": run_id,
                }
                # Stable idempotency: repeated source/hash updates last-seen and count,
                # but the original raw evidence is never deleted.
                query = "scout_findings?on_conflict=source,payload_sha256"
                supabase_request(base, key, query, "POST", row,
                    "resolution=merge-duplicates,return=minimal")
                staged += 1
            result["sources"][source] = {"status": "OK", "items_seen": len(items),
                                         "staged": staged, "elapsed_seconds": round(time.monotonic()-started, 2)}
            result["harvested_count"] += staged
        except Exception as exc:
            result["error_count"] += 1
            result["sources"][source] = {"status": "ERROR", "error": str(exc)[:800],
                                         "elapsed_seconds": round(time.monotonic()-started, 2)}
            print(f"SCOUT_SOURCE_ERROR {source}: {exc}", file=sys.stderr)

    result["finished_at"] = utc_now()
    result["summary_hash"] = sha256(canonical_json(result))
    status = "COMPLETE" if result["error_count"] == 0 else ("PARTIAL" if result["harvested_count"] else "FAILED")
    patch = {
        "status": status,
        "finished_at": result["finished_at"],
        "source_results": result["sources"],
        "harvested_count": result["harvested_count"],
        "error_count": result["error_count"],
        "summary_hash": result["summary_hash"],
    }
    supabase_request(base, key, f"scout_runs?id=eq.{urllib.parse.quote(run_id)}", "PATCH", patch, "return=minimal")
    result["status"] = status
    result["revenue_effect"] = "NONE"
    result["economic_ledger_written"] = False
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result["harvested_count"] > 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
