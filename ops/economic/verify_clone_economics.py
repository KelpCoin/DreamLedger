#!/usr/bin/env python3
"""Read-only economic and silo-clone readiness audit for DreamLedger.

This tool never contacts Stripe, Supabase, Render, Cloudflare, Neon or a chain.
It inspects committed source contracts, writes a proof JSON and exits zero unless
--strict is supplied and blockers remain. BLOCKED means the audit worked and
found missing evidence; it must never be interpreted as an infrastructure failure.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
REGISTRY_PATH = ROOT / "ops/economic/silo-clone-registry.json"
EMPTY_SHA256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def read_text(path: Path) -> str | None:
    try:
        return path.read_text(encoding="utf-8-sig")
    except (OSError, UnicodeError):
        return None


def read_json(path: Path) -> dict[str, Any] | None:
    raw = read_text(path)
    if raw is None:
        return None
    try:
        value = json.loads(raw)
    except json.JSONDecodeError:
        return None
    return value if isinstance(value, dict) else None


def tracked_paths() -> list[str]:
    """Use Git's index so historical backups or ignored files cannot satisfy a gate."""
    try:
        proc = subprocess.run(
            ["git", "ls-files", "-z"],
            cwd=ROOT,
            capture_output=True,
            check=False,
        )
        if proc.returncode == 0:
            return [
                item.decode("utf-8", "replace").replace("\\", "/")
                for item in proc.stdout.split(b"\0")
                if item
            ]
    except OSError:
        pass
    ignored = {".git", "node_modules", ".venv", "__pycache__", "archive", "archives"}
    found: list[str] = []
    for path in ROOT.rglob("*"):
        if not path.is_file():
            continue
        relative = path.relative_to(ROOT)
        if any(part.lower() in ignored for part in relative.parts):
            continue
        found.append(relative.as_posix())
    return found


def file_for(paths: list[str], basename: str) -> str | None:
    matches = [p for p in paths if PurePosixPath(p).name.lower() == basename.lower()]
    # Historical proof/backup copies are evidence, not executable source.
    active = [
        p for p in matches
        if not any(word in p.lower().split("/") for word in ("archive", "archives", "proof", "backup", "backups"))
    ]
    if not active:
        return None
    active.sort(key=lambda p: (len(p), p))
    return active[0]


def add_check(
    checks: list[dict[str, Any]],
    check_id: str,
    status: str,
    detail: str,
    evidence: list[str] | None = None,
) -> None:
    checks.append({
        "id": check_id,
        "status": status,
        "detail": detail,
        "evidence": evidence or [],
    })


def source_hashes(paths: list[str]) -> dict[str, str]:
    result: dict[str, str] = {}
    for rel in paths:
        p = ROOT / rel
        try:
            result[rel] = sha256_bytes(p.read_bytes())
        except OSError:
            continue
    return result


def run_audit(output_path: Path) -> dict[str, Any]:
    checks: list[dict[str, Any]] = []
    paths = tracked_paths()
    registry = read_json(REGISTRY_PATH)
    if registry is None:
        add_check(checks, "REGISTRY_JSON", "FAIL", "Registry file is missing or invalid JSON.", ["ops/economic/silo-clone-registry.json"])
        registry = {}

    silos = registry.get("silos", [])
    master_id = registry.get("clone_factory", {}).get("master_silo_id")
    ids = [s.get("silo_id") for s in silos if isinstance(s, dict)]
    domains = [s.get("domain_candidate") for s in silos if isinstance(s, dict)]
    exactly_one_master = sum(1 for s in silos if s.get("role") == "CANONICAL_MASTER") == 1
    master = next((s for s in silos if s.get("silo_id") == master_id), None)
    clones = [s for s in silos if s.get("role") == "REUSABLE_VERTICAL_CLONE"]
    duplicate_ids = len(ids) != len(set(ids))
    duplicate_domains = len(domains) != len(set(domains))
    all_staged = all(
        (s.get("state") == "DESIGNATED_MASTER_SCHEMA_AND_LIVE_FLOW_UNVERIFIED" if s.get("role") == "CANONICAL_MASTER"
         else s.get("state") == "STAGED_CONFIG_ONLY")
        and not any(bool(v) for v in s.get("readiness", {}).values()
                    if isinstance(v, bool) and v is True)
        for s in silos
    )
    registry_ok = (
        registry.get("schema") == "BEC-PRIME/ECONOMIC-SILO-CLONE-REGISTRY/v1"
        and exactly_one_master and master is not None
        and not duplicate_ids and not duplicate_domains
        and len(silos) >= 10 and len(clones) >= 5 and all_staged
        and registry.get("clone_factory", {}).get("production_provisioning_authorized") is False
        and registry.get("cube_scaling", {}).get("automatic_provisioning_enabled") is False
        and registry.get("economic_truth", {}).get("verified_external_revenue_nzd") == 0
    )
    add_check(
        checks, "STAGED_SILO_REGISTRY",
        "PASS" if registry_ok else "FAIL",
        f"{len(silos)} silo configurations; {len(clones)} clone candidates; exactly one designated MTG master; live provisioning and autoscaling remain disabled."
        if registry_ok else "Registry invariant failure: inspect unique IDs/domains, master role, staged states, revenue truth and disabled mutation flags.",
        ["ops/economic/silo-clone-registry.json"],
    )

    economic_truth = registry.get("economic_truth", {})
    add_check(
        checks, "REVENUE_TRUTH",
        "PASS" if economic_truth.get("verified_external_revenue_nzd") == 0 else "FAIL",
        "The repository's current evidence snapshot remains NZ$0 verified external revenue. This is not a live Stripe reconciliation.",
        ["BEC-PRIME/OWN-FIRST-COMPANY-OPERATOR.json", "ops/economic/silo-clone-registry.json"],
    )

    expected_sources = [
        "BEC-PRIME/OWN-FIRST-COMPANY-OPERATOR.json",
        "BEC-PRIME/catalog/products/COMMANDER-DECK-DIAGNOSTIC-001.json",
        "BEC-PRIME/catalog/products/DREAMLEDGER-BILLBOARD-FOUNDING-001.json",
        "BEC-PRIME/fulfillment/PRODUCT-FULFILLMENT-REGISTRY.json",
        ".github/workflows/mtg-diagnostic-fulfillment.yml",
        "public/billboard.html",
        "public/avatar.html",
        "ops/economic/cube_epv_gate.py",
    ]
    for rel in expected_sources:
        status = "PASS" if (ROOT / rel).is_file() else "BLOCKED"
        add_check(
            checks, "SOURCE:" + rel,
            status,
            "Source file available for static audit." if status == "PASS" else "Expected source file is not present at this path.",
            [rel],
        )

    mtg_product_path = ROOT / "BEC-PRIME/catalog/products/COMMANDER-DECK-DIAGNOSTIC-001.json"
    mtg_product = read_json(mtg_product_path)
    registry_path = ROOT / "BEC-PRIME/fulfillment/PRODUCT-FULFILLMENT-REGISTRY.json"
    fulfillment = read_json(registry_path)
    mtg_gate_path = ROOT / ".github/workflows/mtg-diagnostic-fulfillment.yml"
    mtg_gate = read_text(mtg_gate_path) or ""
    if mtg_product is None:
        add_check(checks, "MTG_DIAGNOSTIC_CHECKOUT", "BLOCKED", "MTG diagnostic product metadata could not be read.", ["BEC-PRIME/catalog/products/COMMANDER-DECK-DIAGNOSTIC-001.json"])
    else:
        is_held = (
            mtg_product.get("status") != "published"
            or mtg_product.get("checkout", {}).get("mode") == "disabled"
            or mtg_product.get("fulfillment", {}).get("mode") == "disabled"
            or mtg_product.get("commercial_truth", {}).get("sellable") is False
        )
        add_check(
            checks, "MTG_DIAGNOSTIC_CHECKOUT",
            "BLOCKED" if is_held else "WARN",
            "Commander diagnostic is held/checkout-disabled in source; do not treat NZ$29 as a buyable offer until checkout, settlement and durable delivery are proven."
            if is_held else "Product metadata does not show the known held state; live checkout and delivery still require independent proof.",
            ["BEC-PRIME/catalog/products/COMMANDER-DECK-DIAGNOSTIC-001.json"],
        )

    entry = (fulfillment or {}).get("entries", {}).get("COMMANDER-DECK-DIAGNOSTIC-001", {})
    product_mode = (mtg_product or {}).get("fulfillment", {}).get("mode")
    registry_ready = entry.get("ready") is True
    contradictory = registry_ready and (product_mode != "automated" or (mtg_product or {}).get("status") != "published")
    add_check(
        checks, "MTG_PRODUCT_FULFILLMENT_CONSISTENCY",
        "BLOCKED" if contradictory else "PASS",
        "Catalog product and fulfillment registry disagree: registry says ready=true/operator_required=false, while the product remains held with fulfillment disabled."
        if contradictory else "Product and fulfillment registry do not show the known contradiction.",
        ["BEC-PRIME/catalog/products/COMMANDER-DECK-DIAGNOSTIC-001.json", "BEC-PRIME/fulfillment/PRODUCT-FULFILLMENT-REGISTRY.json"],
    )

    gate_supports_held_state = (
        "$p.status -eq 'held'" in mtg_gate
        and "$p.checkout.mode -eq 'disabled'" in mtg_gate
        and "$p.fulfillment.mode -eq 'disabled'" in mtg_gate
        and "$e.ready -eq $false" in mtg_gate
    )
    held_state_consistent = (
        (mtg_product or {}).get("status") == "held"
        and (mtg_product or {}).get("checkout", {}).get("mode") == "disabled"
        and product_mode == "disabled"
        and (mtg_product or {}).get("fulfillment", {}).get("operator_required") is True
        and entry.get("ready") is False
        and entry.get("operator_required") is True
    )
    gate_expects_automated = "$p.fulfillment.mode -ne 'automated'" in mtg_gate
    gate_ok = (gate_supports_held_state and held_state_consistent) or (
        not gate_expects_automated and not contradictory
    )
    add_check(
        checks, "MTG_CI_EXPECTATION",
        "PASS" if gate_ok else "BLOCKED",
        "The MTG gate accepts the held/closed product state and checks registry consistency; checkout remains disabled."
        if gate_ok else "The MTG gate and product/fulfillment metadata still disagree about whether this SKU is held or production-ready.",
        [".github/workflows/mtg-diagnostic-fulfillment.yml", "BEC-PRIME/catalog/products/COMMANDER-DECK-DIAGNOSTIC-001.json", "BEC-PRIME/fulfillment/PRODUCT-FULFILLMENT-REGISTRY.json"],
    )

    billboard_product = read_json(ROOT / "BEC-PRIME/catalog/products/DREAMLEDGER-BILLBOARD-FOUNDING-001.json")
    billboard_page = read_text(ROOT / "public/billboard.html") or ""
    manifest_payment_link = ((billboard_product or {}).get("commercial_truth") or {}).get("payment_link")
    billboard_html_link = "buy.stripe.com/" in billboard_page
    billboard_held = (
        (billboard_product or {}).get("status") != "published"
        or manifest_payment_link is None
        or ((billboard_product or {}).get("commercial_truth") or {}).get("evidence_status") == "checkout_held_missing_public_intake"
    )
    conflict = billboard_html_link and billboard_held
    add_check(
        checks, "BILLBOARD_CHECKOUT_MANIFEST_PARITY",
        "BLOCKED" if conflict else ("WARN" if billboard_html_link else "BLOCKED"),
        "Public billboard HTML contains a Stripe checkout URL, but the structured product record says payment_link=null and checkout is held for missing secure intake. A link on a page does not prove that the buyer's placement data, settlement and fulfillment reconcile."
        if conflict else "Public payment URL and structured product checkout state still require live Stripe and fulfillment verification.",
        ["public/billboard.html", "BEC-PRIME/catalog/products/DREAMLEDGER-BILLBOARD-FOUNDING-001.json"],
    )

    avatar_page = read_text(ROOT / "public/avatar.html") or ""
    avatar_demo_unlock = "Unlock demo" in avatar_page and "Wire Stripe for real" in avatar_page
    avatar_support_route = "/buy/DREAMMEEZ-SUPPORTER-SPROUT" in avatar_page
    add_check(
        checks, "AVATAR_COSMETIC_SETTLEMENT_PARITY",
        "BLOCKED" if avatar_demo_unlock and avatar_support_route else "WARN",
        "The avatar page exposes local demo unlock for per-item cosmetics and separately links a NZ$3.99 supporter SKU. Do not claim a specific cosmetic was paid for or delivered until SKU identity, checkout, entitlement and receipt are joined.",
        ["public/avatar.html"],
    )

    operator = read_json(ROOT / "BEC-PRIME/OWN-FIRST-COMPANY-OPERATOR.json")
    operator_offer = ((operator or {}).get("narrowing_chain") or {}).get("offer", {}).get("id")
    billboard_is_first_offer = operator_offer == "DREAMLEDGER-BILLBOARD-FOUNDING-001"
    add_check(
        checks, "CURRENT_COMMERCIAL_PRIORITY_ALIGNMENT",
        "PASS" if billboard_is_first_offer else "BLOCKED",
        "Own-first operator prioritizes the requested NZ$50 founding billboard offer; its own stated gates still block distribution until checkout and delivery are reconciled."
        if billboard_is_first_offer else "Own-first operator's selected offer diverges from the current owner-directed billboard/avatar/MTG priorities.",
        ["BEC-PRIME/OWN-FIRST-COMPANY-OPERATOR.json", "ops/economic/silo-clone-registry.json"],
    )

    required_artifacts = {
        "MTG_SCHEMA_SOURCE": "schema_nz_mtg_silo.sql",
        "MTG_SEED_SOURCE": "seed_nz_mtg.sql",
        "CUBE_SCALER_SOURCE": "cube_swarm_scaler.py",
        "TENANT_SPAWNER_SOURCE": "bec_tenant_spawner.py",
        "DOMINO_FENCING_SOURCE": "schema_domino02_fencing.sql",
        "REBUILT_ENGINE_SOURCE": "beck_engine_rebuilt.py",
        "TEN_DOMAIN_MIGRATION_SOURCE": "silo-migration-10-domains.sql",
    }
    artifact_locations: dict[str, str | None] = {}
    for check_id, basename in required_artifacts.items():
        found = file_for(paths, basename)
        artifact_locations[basename] = found
        add_check(
            checks, check_id,
            "PASS" if found else "BLOCKED",
            f"Found tracked source at {found}." if found else f"{basename} was not found among tracked files in KelpCoin/DreamLedger; any Studio-only copy was not accessible for executable validation.",
            [found] if found else [basename],
        )

    cube_gate_source = read_text(ROOT / "ops/economic/cube_epv_gate.py") or ""
    cube_gate_safe = (
        "APPLY_ENABLED = False" in cube_gate_source
        and "HMAC-SHA256" in cube_gate_source
        and "HOLD_NO_SCALE_RUNTIME_UNVERIFIED" in cube_gate_source
        and "pipeline_value" not in cube_gate_source.lower().split("def compute_epv")[1].split("def verify_evidence")[0]
    )
    add_check(
        checks, "CUBE_EPV_GATE_SOURCE",
        "PASS" if cube_gate_safe else "FAIL",
        "Decision-only EPV gate requires signed reconciliation evidence, excludes pipeline value from the EPV calculation and cannot mutate workers."
        if cube_gate_safe else "CUBE EPV gate is missing required fail-closed or no-side-effect protections.",
        ["ops/economic/cube_epv_gate.py"],
    )

    scaling = registry.get("cube_scaling", {})
    scale_safe = (
        scaling.get("automatic_provisioning_enabled") is False
        and scaling.get("live_worker_pool_status") == "NOT_VERIFIED"
        and scaling.get("maximum_live_workers_before_all_gates_pass") == 1
        and scaling.get("no_scale_from_pipeline_value") is True
        and scaling.get("epv_floor_nzd") == 25
        and scaling.get("winner_expansion_threshold_nzd") == 120
        and scaling.get("configured_ceiling_workers") == 64
    )
    add_check(
        checks, "CUBE_SCALE_GUARD",
        "PASS" if scale_safe else "FAIL",
        "CUBE expansion remains disabled until real worker runtime, queue, tenant fences and net-contribution data are verified; thresholds are recorded as proposed policy only."
        if scale_safe else "CUBE guard invariant failed.",
        ["ops/economic/silo-clone-registry.json"],
    )

    add_check(
        checks, "LIVE_EXTERNAL_RECONCILIATION",
        "BLOCKED",
        "This audit has not inspected a selected Stripe account's live product/session/events or independently matched payment -> attribution -> fulfillment -> delivery. No transaction or revenue is claimed.",
        ["Stripe live inspection not run: connected account selection required", "Verified external revenue remains NZ$0 in the source snapshot."],
    )

    blocked = sum(1 for c in checks if c["status"] in ("BLOCKED", "FAIL"))
    warnings = sum(1 for c in checks if c["status"] == "WARN")
    passed = sum(1 for c in checks if c["status"] == "PASS")
    try:
        sha = subprocess.run(
            ["git", "rev-parse", "HEAD"], cwd=ROOT, capture_output=True, text=True, check=False
        ).stdout.strip() or None
    except OSError:
        sha = None
    report = {
        "schema": "BEC-PRIME/ECONOMIC-READINESS-AUDIT/v1",
        "observed_at_utc": datetime.now(timezone.utc).isoformat(),
        "repository": "KelpCoin/DreamLedger",
        "source_commit_sha": sha,
        "audit_mode": "READ_ONLY_STATIC_SOURCE_INSPECTION",
        "overall_status": "BLOCKED" if blocked else ("WARN" if warnings else "PASS"),
        "verified_external_revenue_nzd": 0,
        "silo_registry": {
            "master_silo_id": master_id,
            "silo_configurations": len(silos),
            "staged_clone_candidates": len(clones),
            "production_silos_verified": 0,
            "automatic_scaling_enabled": False,
        },
        "summary": {"pass": passed, "warn": warnings, "blocked_or_fail": blocked, "total": len(checks)},
        "required_artifacts_found": {name: location for name, location in artifact_locations.items()},
        "source_sha256": source_hashes([p for p in expected_sources if (ROOT / p).is_file()]),
        "checks": checks,
        "disclaimer": "This report measures source-contract consistency, not a live database migration, Stripe transaction, deployment, or worker benchmark. It must not be interpreted as proof that any silo is live or that revenue exists.",
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", default="proof/economic/BEC-ECONOMIC-READINESS.json")
    parser.add_argument("--strict", action="store_true", help="exit nonzero when any blocker remains")
    args = parser.parse_args()
    output = Path(args.output)
    if not output.is_absolute():
        output = ROOT / output
    report = run_audit(output)
    print(json.dumps({
        "overall_status": report["overall_status"],
        "summary": report["summary"],
        "verified_external_revenue_nzd": report["verified_external_revenue_nzd"],
        "silo_registry": report["silo_registry"],
        "proof_path": str(output.relative_to(ROOT)) if output.is_relative_to(ROOT) else str(output),
    }, indent=2))
    if args.strict and report["overall_status"] == "BLOCKED":
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
