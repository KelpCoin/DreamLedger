#!/usr/bin/env python3
"""Read-only first-revenue task for DreamLedger North Star.

Collects source-backed MTG checkout evidence and a throttled fake-session HTTP
probe. It never creates checkout, writes to Supabase, or performs a payment.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import shutil
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

SCRIPT = Path(__file__).resolve()
ROOT = Path(os.environ.get("DREAMLEDGER_ROOT", str(SCRIPT.parents[2]))).resolve()
TASK_REL = Path("ops/cube-swarm/tasks/MTG-CMD-DIAG-29-READ-ONLY-AUDIT")
TASK_JSON = ROOT / (str(TASK_REL) + ".json")
AUDIT_REL = Path("LAKE/FIGURE8/evidence/MTG-CMD-DIAG-29-CHECKOUT-AUDIT.json")
AUDIT_PATH = ROOT / AUDIT_REL
PROBE_CACHE = ROOT / "runtime" / "lm_studio" / "state" / "NORTH-STAR-GATE1-PROBE.json"
PROJECT_REF = os.environ.get("DREAMLEDGER_SUPABASE_PROJECT_REF", "wbwgroygjeyukkspnqiy")
PROBE_INTERVAL_SECONDS = max(300, int(os.environ.get("NORTH_STAR_GATE1_PROBE_INTERVAL_SECONDS", "1800")))
RELEVANT = re.compile(
    r"commander|diagnostic|stripe|checkout|session|payment|settle|webhook|"
    r"fulfill|delivery|report|sku|price|signature|livemode|payment_status|"
    r"checkout\.session|STRIPE_WEBHOOK_SECRET",
    re.IGNORECASE,
)
SECRET_PATTERNS = [
    (re.compile(r"\bsk_(?:live|test)_[A-Za-z0-9]+\b"), "[REDACTED_STRIPE_KEY]"),
    (re.compile(r"\bwhsec_[A-Za-z0-9]+\b"), "[REDACTED_WEBHOOK_SECRET]"),
    (re.compile(r"\b(?:sb_secret|sb_publishable)_[A-Za-z0-9_-]+\b"), "[REDACTED_SUPABASE_KEY]"),
]
MAX_EXCERPTS_PER_FILE = 18
MAX_LINE_CHARS = 280


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def redact(value: str) -> str:
    out = value
    for pattern, replacement in SECRET_PATTERNS:
        out = pattern.sub(replacement, out)
    out = re.sub(
        r"(?i)((?:STRIPE_API_KEY|STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|SUPABASE_SERVICE_ROLE_KEY)\s*[:=]\s*)[^\s,;]+",
        r"\1[REDACTED]",
        out,
    )
    return out


def safe_path(root: Path, relative: str) -> Path:
    target = (root / relative).resolve()
    if target != root and root not in target.parents:
        raise ValueError("SOURCE_PATH_OUTSIDE_REPOSITORY")
    return target


def classify_probe_status(status_code: int | None, response_error: str = "") -> str:
    if status_code == 503 or response_error == "STRIPE_CONFIG_MISSING":
        return "STRIPE_CONFIG_MISSING"
    if status_code == 500 or response_error == "STRIPE_SESSION_LOOKUP_FAILED":
        return "SESSION_LOOKUP_FAILED_KEY_VALIDITY_NOT_CONFIRMED"
    if status_code is None:
        return "NOT_VERIFIED_NETWORK_OR_REQUEST_FAILURE"
    return "HTTP_STATUS_REQUIRES_REVIEW"


def get_probe_cache() -> dict:
    try:
        value = json.loads(PROBE_CACHE.read_text(encoding="utf-8"))
        checked = datetime.fromisoformat(str(value.get("checked_at_utc", "")).replace("Z", "+00:00"))
        age = (datetime.now(timezone.utc) - checked.astimezone(timezone.utc)).total_seconds()
        ttl = 300 if value.get("branch_classification") == "STRIPE_CONFIG_MISSING" else PROBE_INTERVAL_SECONDS
        if age >= 0 and age < ttl:
            value["reused_cached_result"] = True
            return value
    except Exception:
        pass
    return {}


def probe_delivery_gate() -> dict:
    cached = get_probe_cache()
    if cached:
        return cached

    url = "https://" + PROJECT_REF + ".supabase.co/functions/v1/marketplace-diagnostic-delivery"
    fake_session = "cs_test_northstar_fake_not_a_real_checkout"
    request_url = url + "?" + urlencode({"session_id": fake_session})
    request = Request(request_url, headers={"Accept": "application/json", "User-Agent": "DreamLedger-NorthStar-ReadOnlyAudit/1"})
    status_code = None
    response_error = ""
    error_type = ""
    try:
        try:
            with urlopen(request, timeout=8) as response:
                status_code = int(response.status)
                body = response.read(1024).decode("utf-8", errors="replace")
        except HTTPError as exc:
            status_code = int(exc.code)
            body = exc.read(1024).decode("utf-8", errors="replace")
        try:
            parsed = json.loads(body)
            candidate = parsed.get("error", "")
            if candidate in {"STRIPE_CONFIG_MISSING", "STRIPE_SESSION_LOOKUP_FAILED"}:
                response_error = candidate
        except Exception:
            pass
        error_type = classify_probe_status(status_code, response_error)
    except (URLError, TimeoutError, OSError) as exc:
        error_type = "NOT_VERIFIED_NETWORK_OR_REQUEST_FAILURE"
        response_error = type(exc).__name__

    result = {
        "checked_at_utc": utc_now(),
        "http_status": status_code,
        "branch_classification": error_type,
        "response_error_code": response_error if response_error in {"STRIPE_CONFIG_MISSING", "STRIPE_SESSION_LOOKUP_FAILED"} else "",
        "fake_session_used": True,
        "session_id_recorded": False,
        "secret_value_read_or_written": False,
        "reused_cached_result": False,
        "interpretation": (
            "503 confirms the function did not obtain a usable configured Stripe key at probe time."
            if error_type == "STRIPE_CONFIG_MISSING"
            else "500 shows the function reached the lookup exception branch; it does not prove the key is valid."
            if error_type == "SESSION_LOOKUP_FAILED_KEY_VALIDITY_NOT_CONFIRMED"
            else "This status alone does not establish successful settlement, fulfillment, or revenue."
        ),
    }
    PROBE_CACHE.parent.mkdir(parents=True, exist_ok=True)
    tmp = PROBE_CACHE.with_suffix(".tmp")
    tmp.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    os.replace(tmp, PROBE_CACHE)
    return result


def git_commit(root: Path) -> str:
    try:
        proc = subprocess.run(
            ["git", "-C", str(root), "rev-parse", "HEAD"],
            capture_output=True, text=True, timeout=5, check=False,
        )
        value = proc.stdout.strip()
        if proc.returncode == 0 and re.fullmatch(r"[0-9a-f]{40}", value):
            return value
    except Exception:
        pass
    return "UNAVAILABLE"


def excerpts_for(relative: str, text: str) -> list[dict]:
    lines = text.splitlines()
    if relative == "public/catalog.json":
        try:
            data = json.loads(text)
            products = data.get("products", []) if isinstance(data, dict) else []
            selected = []
            for product in products:
                blob = json.dumps(product, ensure_ascii=False).lower()
                if "cmd-diag-29" in blob or "commander-deck-diagnostic-001" in blob or ("commander" in blob and "diagnostic" in blob):
                    fields = {
                        key: product.get(key)
                        for key in ("id", "sku", "name", "price", "currency", "status", "checkout_url")
                        if key in product
                    }
                    selected.append({"line": None, "text": redact(json.dumps(fields, ensure_ascii=False))[:MAX_LINE_CHARS * 3]})
            return selected[:5]
        except Exception:
            return []

    matches = [i for i, line in enumerate(lines) if RELEVANT.search(line)]
    chosen: list[int] = []
    for i in matches:
        for j in (i - 1, i, i + 1):
            if 0 <= j < len(lines) and j not in chosen:
                chosen.append(j)
        if len(chosen) >= MAX_EXCERPTS_PER_FILE:
            break
    return [
        {"line": i + 1, "text": redact(lines[i].strip())[:MAX_LINE_CHARS]}
        for i in sorted(chosen)[:MAX_EXCERPTS_PER_FILE]
    ]


def read_source(root: Path, relative: str) -> dict:
    try:
        target = safe_path(root, relative)
    except ValueError as exc:
        return {"path": relative, "status": "BLOCKED_PATH", "error": str(exc)}
    if not target.is_file():
        return {"path": relative, "status": "SOURCE_MISSING", "sha256": None, "bytes": 0, "excerpt": []}
    try:
        raw = target.read_bytes()
        text = raw.decode("utf-8", errors="replace")
        return {
            "path": relative,
            "status": "SOURCE_PRESENT",
            "sha256": sha256_bytes(raw),
            "bytes": len(raw),
            "line_count": len(text.splitlines()),
            "excerpt": excerpts_for(relative, text),
        }
    except OSError as exc:
        return {"path": relative, "status": "SOURCE_READ_ERROR", "sha256": None, "bytes": 0, "excerpt": [], "error": type(exc).__name__}


def load_task(root: Path) -> dict:
    try:
        value = json.loads(TASK_JSON.read_text(encoding="utf-8"))
        if not isinstance(value, dict) or value.get("task_id") != "MTG-CMD-DIAG-29-READ-ONLY-AUDIT":
            raise ValueError("UNEXPECTED_TASK_CONTRACT")
        return value
    except Exception as exc:
        return {"task_id": "MTG-CMD-DIAG-29-READ-ONLY-AUDIT", "task_load_error": type(exc).__name__, "inputs": {"starting_sources": []}}


def check_inline_javascript(html_text: str) -> dict:
    blocks = re.findall(r"<script\b(?![^>]*\bsrc=)[^>]*>(.*?)</script\s*>", html_text, re.IGNORECASE | re.DOTALL)
    if not blocks:
        return {"status": "NOT_VERIFIED", "reason": "NO_INLINE_SCRIPT_FOUND", "script_count": 0}
    node = shutil.which("node")
    if not node:
        return {"status": "NOT_VERIFIED", "reason": "NODE_NOT_FOUND", "script_count": len(blocks)}
    failures = []
    for index, source in enumerate(blocks, start=1):
        temp_name = None
        try:
            with tempfile.NamedTemporaryFile("w", encoding="utf-8", suffix=".js", delete=False) as tmp:
                tmp.write(source)
                temp_name = tmp.name
            proc = subprocess.run([node, "--check", temp_name], capture_output=True, text=True, timeout=10, check=False)
            if proc.returncode != 0:
                failures.append({
                    "script_index": index,
                    "returncode": proc.returncode,
                    "diagnostic": redact((proc.stderr or proc.stdout or "node --check failed")[-1200:]),
                })
        except Exception as exc:
            return {"status": "NOT_VERIFIED", "reason": type(exc).__name__, "script_count": len(blocks)}
        finally:
            if temp_name:
                try:
                    os.unlink(temp_name)
                except OSError:
                    pass
    return {
        "status": "FAIL" if failures else "PASS",
        "reason": "INLINE_SCRIPT_SYNTAX_ERROR" if failures else "ALL_INLINE_SCRIPTS_PARSE",
        "script_count": len(blocks),
        "failures": failures,
    }


def facts_from_sources(root: Path, sources: list[dict]) -> dict:
    catalog_entry = None
    page_text = ""
    route_text = ""
    fulfillment_text = ""
    presence = {str(s.get("path")): s.get("status") == "SOURCE_PRESENT" for s in sources}
    try:
        catalog_path = safe_path(root, "public/catalog.json")
        catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
        products = catalog.get("products", []) if isinstance(catalog, dict) else []
        for product in products:
            if str(product.get("sku", "")).upper() == "CMD-DIAG-29" or str(product.get("id", "")).upper() == "COMMANDER-DECK-DIAGNOSTIC-001":
                catalog_entry = {
                    "id": product.get("id"),
                    "sku": product.get("sku"),
                    "name": product.get("name"),
                    "price": product.get("price"),
                    "currency": product.get("currency"),
                    "status": product.get("status"),
                    "checkout_url_present": str(product.get("checkout_url", "")).startswith("https://buy.stripe.com/"),
                }
                break
    except Exception:
        pass
    try:
        page_text = safe_path(root, "public/mtg/index.html").read_text(encoding="utf-8", errors="replace")
    except Exception:
        pass
    try:
        route_text = safe_path(root, "BEC-PRIME/routes/mtgDiagnostic.js").read_text(encoding="utf-8", errors="replace")
    except Exception:
        pass
    try:
        fulfillment_text = safe_path(root, "BEC-PRIME/lib/mtgDiagnosticFulfillment.js").read_text(encoding="utf-8", errors="replace")
    except Exception:
        pass

    landing_price_present = bool(re.search(r"Commander\s+diagnostic[^\n]{0,100}NZ\$29", page_text, re.IGNORECASE))
    landing_checkout_present = "buy.stripe.com/" in page_text
    inline_js_syntax = check_inline_javascript(page_text)
    route_checkout_markers = bool(re.search(r"checkout|checkout\.sessions|session_id", route_text, re.IGNORECASE))
    route_webhook_markers = bool(re.search(r"webhook|checkout\.session\.completed|stripe-signature", route_text, re.IGNORECASE))
    fulfillment_markers = bool(re.search(r"report|fulfill|artifact|delivery", fulfillment_text, re.IGNORECASE))

    checks = [
        {
            "id": "MTG_LANDING_STATIC_OFFER",
            "status": "PASS" if presence.get("public/mtg/index.html") and landing_price_present and landing_checkout_present else "BLOCKED",
            "evidence_refs": ["public/mtg/index.html"],
            "finding": "Source contains the Commander diagnostic NZ$29 label and a Stripe Checkout link." if presence.get("public/mtg/index.html") and landing_price_present and landing_checkout_present else "The source, NZ$29 label, or Stripe Checkout URL was not found.",
            "runtime_deploy_verified": False,
        },
        {
            "id": "PUBLIC_LANDING_JS_SYNTAX",
            "status": "PASS" if inline_js_syntax.get("status") == "PASS" else "BLOCKED" if inline_js_syntax.get("status") == "FAIL" else "NOT_VERIFIED",
            "evidence_refs": ["public/mtg/index.html"],
            "syntax_check": inline_js_syntax,
            "finding": "Every inline JavaScript block in the MTG landing page parses successfully." if inline_js_syntax.get("status") == "PASS" else "MTG landing page has an inline JavaScript syntax error; repair before relying on product rendering." if inline_js_syntax.get("status") == "FAIL" else "Inline JavaScript syntax could not be verified in this environment.",
            "runtime_deploy_verified": False,
        },
        {
            "id": "CATALOG_SKU_PRICE_LINK",
            "status": "PASS" if catalog_entry and catalog_entry.get("sku") == "CMD-DIAG-29" and catalog_entry.get("price") == 29 and str(catalog_entry.get("currency", "")).lower() == "nzd" and catalog_entry.get("checkout_url_present") else "BLOCKED",
            "evidence_refs": ["public/catalog.json"],
            "catalog_entry": catalog_entry,
            "finding": "Static catalogue mapping has SKU CMD-DIAG-29, NZD 29, and a Stripe link." if catalog_entry and catalog_entry.get("sku") == "CMD-DIAG-29" and catalog_entry.get("price") == 29 and str(catalog_entry.get("currency", "")).lower() == "nzd" and catalog_entry.get("checkout_url_present") else "Exact product, amount, currency, or Stripe URL did not match the expected static contract.",
            "runtime_deploy_verified": False,
        },
        {
            "id": "CHECKOUT_HANDLER_SOURCE",
            "status": "SOURCE_PRESENT_REVIEW_REQUIRED" if presence.get("BEC-PRIME/routes/mtgDiagnostic.js") and route_checkout_markers else "BLOCKED",
            "evidence_refs": ["BEC-PRIME/routes/mtgDiagnostic.js"],
            "webhook_markers_present": route_webhook_markers,
            "finding": "Checkout-related route source exists; static presence is not proof the route is deployed or webhook-verified." if presence.get("BEC-PRIME/routes/mtgDiagnostic.js") and route_checkout_markers else "Checkout route source or expected markers are missing.",
            "runtime_deploy_verified": False,
        },
        {
            "id": "FULFILLMENT_HANDLER_SOURCE",
            "status": "SOURCE_PRESENT_REVIEW_REQUIRED" if presence.get("BEC-PRIME/lib/mtgDiagnosticFulfillment.js") and fulfillment_markers else "BLOCKED",
            "evidence_refs": ["BEC-PRIME/lib/mtgDiagnosticFulfillment.js"],
            "finding": "Fulfillment-related source exists; successful delivery has not been demonstrated." if presence.get("BEC-PRIME/lib/mtgDiagnosticFulfillment.js") and fulfillment_markers else "Fulfillment source or expected markers are missing.",
            "runtime_deploy_verified": False,
        },
        {
            "id": "DEPLOYED_DELIVERY_FUNCTION_SOURCE",
            "status": "NOT_TRACKED_IN_LOCAL_REPOSITORY" if not presence.get("supabase/functions/marketplace-diagnostic-delivery/index.ts") else "SOURCE_PRESENT_REVIEW_REQUIRED",
            "evidence_refs": ["supabase/functions/marketplace-diagnostic-delivery/index.ts"],
            "finding": "The deployed Supabase function source is not present at the expected path in this checkout; use deployed version evidence for runtime conclusions.",
            "runtime_deploy_verified": False,
        },
        {
            "id": "SETTLEMENT_FULFILLMENT_PROOF",
            "status": "NOT_VERIFIED",
            "evidence_refs": ["public/catalog.json", "BEC-PRIME/routes/mtgDiagnostic.js", "BEC-PRIME/lib/mtgDiagnosticFulfillment.js"],
            "finding": "Local source inspection does not prove an independent buyer, settled live charge, correct attribution, or delivered report.",
            "runtime_deploy_verified": False,
        },
    ]
    return {"catalog_entry": catalog_entry, "checks": checks, "landing_price_present": landing_price_present, "landing_checkout_present": landing_checkout_present, "inline_js_syntax": inline_js_syntax}


def build_report() -> dict:
    root = ROOT
    task = load_task(root)
    source_paths = task.get("inputs", {}).get("starting_sources", [])
    if not isinstance(source_paths, list):
        source_paths = []
    all_paths = [str(TASK_JSON.relative_to(root)).replace("\\", "/")] + [str(p) for p in source_paths]
    sources = [read_source(root, rel) for rel in all_paths]
    facts = facts_from_sources(root, sources)
    probe = probe_delivery_gate()
    blockers = []
    missing = [s.get("path") for s in sources if s.get("status") != "SOURCE_PRESENT" and s.get("path") != str(TASK_JSON.relative_to(root)).replace("\\", "/")]
    if missing:
        blockers.append({"id": "SOURCE_FILES_MISSING_OR_UNREADABLE", "refs": missing})
    if any(c.get("status") == "BLOCKED" for c in facts["checks"]):
        blockers.append({"id": "STATIC_CHECK_FAILED", "refs": [c["id"] for c in facts["checks"] if c.get("status") == "BLOCKED"]})
    if probe.get("branch_classification") == "STRIPE_CONFIG_MISSING":
        blockers.append({"id": "STRIPE_CONFIG_MISSING", "evidence": "Synthetic session probe returned the configured missing-key branch."})
    elif probe.get("branch_classification") == "SESSION_LOOKUP_FAILED_KEY_VALIDITY_NOT_CONFIRMED":
        blockers.append({"id": "STRIPE_SESSION_LOOKUP_UNRESOLVED", "evidence": "Synthetic session probe reached the lookup-exception branch; key validity remains unverified."})
    else:
        blockers.append({"id": "LIVE_STRIPE_LOOKUP_NOT_PROVEN", "evidence": "A fake-session probe does not prove a valid live key, settlement, or fulfillment."})
    blockers.append({"id": "NO_SETTLEMENT_OR_DELIVERY_EVIDENCE", "evidence": "This local task does not query private payment or fulfilment records."})

    task_contract_hash = "sha256:" + sha256_bytes(TASK_JSON.read_bytes()) if TASK_JSON.is_file() else None
    audit = {
        "schema": "dreamledger/mtg-checkout-audit/v1",
        "task_id": "MTG-CMD-DIAG-29-READ-ONLY-AUDIT",
        "observed_at_utc": utc_now(),
        "source_commit": git_commit(root),
        "task_contract_path": str(TASK_JSON.relative_to(root)).replace("\\", "/"),
        "task_contract_sha256": task_contract_hash,
        "required_artifact_path": str(AUDIT_REL).replace("\\", "/"),
        "source_evidence": sources,
        "static_facts": facts,
        "gate1_probe": probe,
        "steps": facts["checks"],
        "blockers": blockers,
        "proposed_reversible_repair": "Review this evidence bundle and correct only verified source/configuration mismatches; do not deploy or change credentials automatically.",
        "tests_required": [
            "Re-probe with a fake session ID after a secrets change; never record the ID or any secret value.",
            "Verify a real settled external charge only from Stripe evidence under an approved test procedure.",
            "Verify canonical SKU, amount, mode, session attribution, fulfillment artifact, and delivery evidence before counting revenue.",
        ],
        "limitations": [
            "This is a local source/static audit plus a synthetic GET probe, not a checkout or delivery test.",
            "The fake-session lookup error does not establish that the Stripe key is valid.",
            "Static source and payment links do not prove deployment, buyer demand, payment settlement, or successful fulfillment.",
        ],
        "external_action_performed": False,
        "external_commercial_action_performed": False,
        "read_only_remote_probe_performed": bool(probe.get("checked_at_utc")),
        "database_write_performed": False,
        "payment_verified": False,
        "fulfillment_verified": False,
        "verified_revenue_nzd": 0,
        "status": "BLOCKED_GATE1_CONFIG_MISSING" if probe.get("branch_classification") == "STRIPE_CONFIG_MISSING" else "AUDIT_INCOMPLETE_REQUIRES_REVIEW",
    }
    AUDIT_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp = AUDIT_PATH.with_suffix(".tmp")
    tmp.write_text(json.dumps(audit, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    os.replace(tmp, AUDIT_PATH)
    audit["artifact_path"] = str(AUDIT_PATH)
    return audit


def self_test() -> int:
    assert classify_probe_status(503, "STRIPE_CONFIG_MISSING") == "STRIPE_CONFIG_MISSING"
    assert classify_probe_status(500, "STRIPE_SESSION_LOOKUP_FAILED") == "SESSION_LOOKUP_FAILED_KEY_VALIDITY_NOT_CONFIRMED"
    assert classify_probe_status(None) == "NOT_VERIFIED_NETWORK_OR_REQUEST_FAILURE"
    assert check_inline_javascript("<script>const x = 1;</script>")["status"] in {"PASS", "NOT_VERIFIED"}
    syntax_result = check_inline_javascript("<script>const x = ;</script>")
    assert syntax_result["status"] in {"FAIL", "NOT_VERIFIED"}
    synthetic_stripe_key = "sk_" + "live_dontprint"
    assert synthetic_stripe_key not in redact("key=" + synthetic_stripe_key)
    assert "[REDACTED_STRIPE_KEY]" in redact(synthetic_stripe_key)
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp).resolve()
        try:
            safe_path(root, "../outside")
            raise AssertionError("path traversal accepted")
        except ValueError:
            pass
    print("NORTH_STAR_PRIORITY_AUDIT_SELF_TEST=PASS")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--json", action="store_true", help="emit the audit report as JSON")
    parser.add_argument("--self-test", action="store_true", help="run offline contract tests without network access")
    args = parser.parse_args()
    if args.self_test:
        return self_test()
    try:
        result = build_report()
        print(json.dumps(result, ensure_ascii=False, separators=(",", ":")) if args.json else json.dumps({
            "status": result["status"],
            "task_id": result["task_id"],
            "artifact_path": result["artifact_path"],
            "gate1_probe": result["gate1_probe"],
            "blocker_count": len(result["blockers"]),
            "external_action_performed": False,
        }, indent=2))
        return 0
    except Exception as exc:
        result = {
            "schema": "dreamledger/mtg-checkout-audit/v1",
            "status": "BLOCKED_AUDIT_EXCEPTION",
            "task_id": "MTG-CMD-DIAG-29-READ-ONLY-AUDIT",
            "observed_at_utc": utc_now(),
            "error_type": type(exc).__name__,
            "error_message": str(exc)[:400],
            "external_action_performed": False,
            "database_write_performed": False,
            "payment_verified": False,
            "fulfillment_verified": False,
            "verified_revenue_nzd": 0,
        }
        try:
            AUDIT_PATH.parent.mkdir(parents=True, exist_ok=True)
            AUDIT_PATH.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
        except Exception:
            pass
        print(json.dumps(result, indent=2), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
