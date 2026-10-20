#!/usr/bin/env python3
"""Generate silo candidate manifests. This tool never provisions live infrastructure."""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_REGISTRY = ROOT / "ops" / "silos" / "CUBE-SILO-CANDIDATE-REGISTRY.json"


def load_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"Could not read valid JSON from {path}: {exc}") from exc
    if not isinstance(value, dict):
        raise ValueError(f"Expected an object in {path}")
    return value


def validate_registry(registry: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    if registry.get("schema") != "dreamledger/cube-silo-candidate-registry/v1":
        errors.append("Unsupported or missing registry schema")
    silos = registry.get("silos")
    if not isinstance(silos, list) or not silos:
        return errors + ["silos must be a non-empty array"]

    ids: list[str] = []
    slugs: list[str] = []
    domains: list[str] = []
    masters = []
    for i, silo in enumerate(silos):
        prefix = f"silos[{i}]"
        if not isinstance(silo, dict):
            errors.append(f"{prefix} must be an object")
            continue
        for field in ("silo_id", "slug", "role", "name", "custom_domain", "primary_route"):
            if not isinstance(silo.get(field), str) or not silo[field].strip():
                errors.append(f"{prefix}.{field} must be a non-empty string")
        silo_id = silo.get("silo_id", "")
        slug = silo.get("slug", "")
        domain = silo.get("custom_domain", "")
        if silo_id:
            ids.append(silo_id)
        if slug:
            slugs.append(slug)
            if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", slug):
                errors.append(f"{prefix}.slug is not URL-safe: {slug}")
        if domain:
            domains.append(domain.lower())
        fee = silo.get("platform_take_rate_pct")
        if fee is not None and (not isinstance(fee, (int, float)) or fee < 0 or fee > 100):
            errors.append(f"{prefix}.platform_take_rate_pct must be null or between 0 and 100")
        if silo.get("role") == "MASTER_REFERENCE":
            masters.append(silo)
            if silo_id != "nz-mtg":
                errors.append("The canonical master must be nz-mtg")
            if fee != 0:
                errors.append("The MTG master must retain a 0% platform take-rate")
        if silo.get("seller_listing_fee_pct") != 0:
            errors.append(f"{prefix} seller listing fee must remain 0 during the free-listing trial")

    for label, values in (("silo_id", ids), ("slug", slugs), ("custom_domain", domains)):
        if len(values) != len(set(values)):
            errors.append(f"Duplicate {label} values detected")
    if len(masters) != 1:
        errors.append(f"Exactly one MASTER_REFERENCE is required; found {len(masters)}")

    truth = registry.get("truth_contract", {})
    if not isinstance(truth, dict) or truth.get("verified_external_revenue_nzd") != 0:
        errors.append("Truth contract must keep verified external revenue at NZ$0 until independently reconciled")
    return errors


def manifest_for(registry: dict[str, Any], silo: dict[str, Any], registry_hash: str) -> dict[str, Any]:
    role = silo["role"]
    stage = {
        "MASTER_REFERENCE": "MASTER_REFERENCE_HELD",
        "EXISTING_CODE_CANDIDATE": "EXISTING_CODE_CANDIDATE_HELD",
        "CANDIDATE": "CANDIDATE_NOT_PROVISIONED",
    }.get(role, "CANDIDATE_NOT_PROVISIONED")
    is_master = role == "MASTER_REFERENCE"
    return {
        "schema": "dreamledger/silo-candidate-manifest/v1",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "registry_sha256": registry_hash,
        "silo_id": silo["silo_id"],
        "slug": silo["slug"],
        "name": silo["name"],
        "role": role,
        "stage": stage,
        "category": silo.get("category"),
        "priority": silo.get("priority"),
        "clone_source": None if is_master else "nz-mtg",
        "primary_route": silo["primary_route"],
        "custom_domain": {
            "requested": silo["custom_domain"],
            "status": "NOT_CONFIGURED",
            "dns_mutation_performed": False,
        },
        "economics": {
            "platform_take_rate_pct": silo.get("platform_take_rate_pct"),
            "seller_listing_fee_pct": silo.get("seller_listing_fee_pct", 0),
            "price_validation": "NOT_RUN",
            "demand_validation": "NOT_RUN",
            "cost_to_serve_validation": "NOT_RUN",
            "verified_revenue_nzd": 0,
            "asset_readiness": silo.get("asset_readiness"),
        },
        "tenant_isolation": {
            "silo_id_required_on_all_records": True,
            "rls_status": "NOT_PROVISIONED_OR_TESTED",
            "cross_tenant_negative_tests": "NOT_RUN",
            "inventory_copied_from_master": False,
            "user_data_copied_from_master": False,
            "vouches_copied_from_master": False,
            "credentials_generated": False,
            "secret_values_in_manifest": False,
        },
        "runtime": {
            "public_route_live": False,
            "payment_link_bound": False,
            "fulfillment_verified": False,
            "database_provisioned": False,
            "production_mutations_performed": False,
        },
        "cube_swarm": {
            "status": "DISABLED_UNTIL_ECONOMIC_GATES_PASS",
            "deployed_workers_verified": 0,
            "candidate_default_workers": 0,
            "max_workers_before_first_verified_sale": 1,
            "scale_up_enabled": False,
            "epv_thresholds_authorize_scale": False,
            "rule": "Only observed net contribution and completed proof can advance a silo. Traffic, generated signals, simulated throughput, active Stripe objects and EPV heuristics alone do not authorize worker creation.",
        },
        "buyer_job": silo.get("buyer_job"),
        "required_data_fields": silo.get("must_have_data", []),
        "additional_gate": silo.get("additional_gate"),
        "go_live_gates": registry["shared_clone_contract"]["go_live_gates"],
        "state": "HOLD",
        "not_a_live_marketplace_notice": "Candidate manifest only. No route, DNS, database row, Stripe link, inventory, external post or worker is provisioned by this file.",
    }


def build(registry_path: Path, output_dir: Path, summary_path: Path | None) -> dict[str, Any]:
    registry = load_json(registry_path)
    errors = validate_registry(registry)
    if errors:
        raise ValueError("; ".join(errors))

    canonical = json.dumps(registry, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    registry_hash = hashlib.sha256(canonical).hexdigest()
    root = output_dir / "silos"
    root.mkdir(parents=True, exist_ok=True)
    entries = []
    for silo in registry["silos"]:
        target = root / silo["slug"] / "manifest.json"
        target.parent.mkdir(parents=True, exist_ok=True)
        manifest = manifest_for(registry, silo, registry_hash)
        target.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        entries.append({
            "silo_id": silo["silo_id"],
            "slug": silo["slug"],
            "stage": manifest["stage"],
            "path": str(target),
            "runtime_live": False,
            "domain_configured": False,
            "database_provisioned": False,
            "payment_link_bound": False,
            "worker_count_verified": 0,
        })
    summary = {
        "schema": "dreamledger/silo-candidate-build-proof/v1",
        "status": "PASS_CANDIDATE_MANIFESTS_GENERATED_NOT_PROVISIONED",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "registry_path": str(registry_path),
        "registry_sha256": registry_hash,
        "candidate_manifest_count": len(entries),
        "master_silo_id": registry["canonical_master"]["silo_id"],
        "entries": entries,
        "verified_external_revenue_nzd": 0,
        "production_mutations_performed": False,
        "dns_changed": False,
        "database_changed": False,
        "stripe_changed": False,
        "workers_provisioned": 0,
        "scale_up_enabled": False,
    }
    if summary_path:
        summary_path.parent.mkdir(parents=True, exist_ok=True)
        summary_path.write_text(json.dumps(summary, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return summary


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--registry", type=Path, default=DEFAULT_REGISTRY)
    parser.add_argument("--output-dir", type=Path, default=Path("build/silo-candidates"))
    parser.add_argument("--summary", type=Path)
    args = parser.parse_args()
    try:
        summary = build(args.registry, args.output_dir, args.summary)
    except (OSError, ValueError) as exc:
        print(json.dumps({"status": "FAIL", "error": str(exc)}, indent=2), file=sys.stderr)
        return 2
    print(json.dumps({
        "status": summary["status"],
        "candidate_manifest_count": summary["candidate_manifest_count"],
        "master_silo_id": summary["master_silo_id"],
        "summary_path": str(args.summary) if args.summary else None,
        "production_mutations_performed": False,
        "workers_provisioned": 0,
    }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
