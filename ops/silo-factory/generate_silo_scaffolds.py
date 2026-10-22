#!/usr/bin/env python3
"""Generate an isolated, empty CUBE silo scaffold pack from the canonical registry.

This is an offline build helper. It does not call DNS, database, Stripe, Cloudflare,
Render, Supabase, Neon, or worker APIs. The output directory must be outside the
repository's public and runtime directories so a scaffold cannot become live by
accident.
"""
from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
REQUIRED_GATES = (
    "provisioned",
    "custom_domain_bound",
    "runtime_isolation_verified",
    "rls_verified",
    "checkout_verified",
    "fulfillment_verified",
    "public_activation_authorized",
    "cube_worker_scaling_authorized",
)


def repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def validate_registry(registry: dict[str, Any]) -> list[dict[str, Any]]:
    if not isinstance(registry, dict) or not isinstance(registry.get("silos"), list):
        raise ValueError("Registry must contain a silos array.")
    silos = registry["silos"]
    if not silos:
        raise ValueError("Registry contains no silos.")

    ids: set[str] = set()
    slugs: set[str] = set()
    domains: set[str] = set()
    routes: set[str] = set()
    masters = 0

    for item in silos:
        if not isinstance(item, dict):
            raise ValueError("Every silo entry must be an object.")
        sid, slug = item.get("id"), item.get("slug")
        domain, route = item.get("proposed_custom_domain"), item.get("route_candidate")
        if not isinstance(sid, str) or not sid.strip():
            raise ValueError("Silo ID is missing.")
        if sid in ids:
            raise ValueError(f"Duplicate silo ID: {sid}")
        ids.add(sid)
        if not isinstance(slug, str) or not SLUG_RE.fullmatch(slug):
            raise ValueError(f"Invalid canonical slug: {slug!r}")
        if slug in slugs:
            raise ValueError(f"Duplicate canonical slug: {slug}")
        slugs.add(slug)
        if not isinstance(domain, str) or not domain.endswith(".dreamledger.org"):
            raise ValueError(f"Invalid proposed custom domain for {slug}: {domain!r}")
        if domain in domains:
            raise ValueError(f"Duplicate proposed domain: {domain}")
        domains.add(domain)
        if not isinstance(route, str) or not route.startswith("/") or " " in route:
            raise ValueError(f"Invalid route candidate for {slug}: {route!r}")
        if route in routes:
            raise ValueError(f"Duplicate route candidate: {route}")
        routes.add(route)
        for gate in REQUIRED_GATES:
            if item.get(gate) is True:
                raise ValueError(f"{slug} claims {gate}=true without provisioning evidence.")
        if slug == "mtg":
            masters += 1
            if item.get("status") != "MASTER_REFERENCE_EXISTING_SURFACE":
                raise ValueError("MTG must remain the canonical master reference.")
            if item.get("commercial_model", {}).get("peer_success_fee_pct") != 0:
                raise ValueError("MTG peer success fee must remain 0% in the scaffold contract.")

    if masters != 1:
        raise ValueError(f"Expected exactly one MTG master, found {masters}.")
    if registry.get("cross_silo_data") is not False:
        raise ValueError("Registry must keep cross_silo_data=false.")
    truth = registry.get("economic_truth", {})
    if truth.get("verified_external_revenue_nzd") != 0:
        raise ValueError("Scaffold generation cannot change verified revenue.")
    return silos


def _json(value: Any) -> str:
    return json.dumps(value, indent=2, ensure_ascii=False, sort_keys=True) + "\n"


def _commercial_model(silo: dict[str, Any]) -> dict[str, Any]:
    model = silo.get("commercial_model") or {}
    return {
        "initial_listing_fee_nzd": model.get("initial_listing_fee_nzd", 0),
        "peer_success_fee_pct": model.get("peer_success_fee_pct"),
        "listing_policy": model.get("listing_policy", "FREE_CANDIDATE_DIRECTORY_OR_CATALOG"),
        "paid_offer_policy": model.get(
            "paid_offer_policy", "UNVALIDATED_DO_NOT_PUBLISH_A_PRICE_OR_ENABLE_CHECKOUT"
        ),
        "commercial_model_status": "UNVALIDATED_NOT_A_REVENUE_CLAIM",
    }


def _preview_html(silo: dict[str, Any]) -> str:
    slug = html.escape(silo["slug"])
    name = html.escape(silo["name"])
    domain = html.escape(silo["proposed_custom_domain"])
    route = html.escape(silo["route_candidate"])
    master = slug == "mtg"
    note = (
        "This is the canonical reference silo. Its existing source assets are linked by reference; "
        "no catalog or customer data is copied into this scaffold bundle."
        if master else
        "This candidate is empty by design. No seller, listing, buyer, price, checkout, or demand is invented."
    )
    return f"""<!doctype html>
<html lang="en-NZ">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{name} | CUBE scaffold preview</title>
<meta name="robots" content="noindex,nofollow">
<style>
body{{font:16px/1.55 system-ui,sans-serif;background:#0b0d12;color:#eef1f6;margin:0}}
main{{max-width:780px;margin:auto;padding:28px 18px 64px}}
article{{border:1px solid #343b4a;border-radius:16px;padding:20px;background:#141923}}
small,.muted{{color:#a8b1c2}}
code{{overflow-wrap:anywhere}}
</style>
</head>
<body><main>
<p class="muted">DreamLedger · CUBE · SCAFFOLD PREVIEW ONLY</p>
<h1>{name}</h1>
<article>
<p><strong>Status: NOT PROVISIONED</strong></p>
<p>{note}</p>
<p>Candidate route: <code>{route}</code></p>
<p>Proposed hostname only: <code>{domain}</code></p>
<p>Listings: 0 scaffold records. Checkout: disabled. Worker scaling: unauthorized.</p>
<p class="muted">A public listing requires verified supply. A sale requires settled payment, correct attribution, completed fulfillment and retrievable delivery proof.</p>
</article>
</main></body>
</html>
"""


def build_bundle(registry: dict[str, Any]) -> dict[str, str]:
    silos = validate_registry(registry)
    created = datetime.now(timezone.utc).isoformat()
    files: dict[str, str] = {}
    index_rows: list[dict[str, Any]] = []

    for silo in silos:
        slug = silo["slug"]
        is_master = slug == "mtg"
        rel_root = f"silos/{slug}"
        manifest = {
            "schema": "dreamledger/cube-silo-scaffold/v1",
            "generated_at_utc": created,
            "silo_id": silo["id"],
            "slug": slug,
            "display_name": silo["name"],
            "master_silo_id": "mtg",
            "is_master_reference": is_master,
            "priority": silo.get("priority"),
            "status": "MASTER_REFERENCE_ONLY" if is_master else "SCAFFOLD_ONLY_NOT_PROVISIONED",
            "proposed_custom_domain": silo["proposed_custom_domain"],
            "custom_domain_bound": False,
            "route_candidate": silo["route_candidate"],
            "route_runtime_verified": False,
            "runtime_isolation_verified": False,
            "rls_verified": False,
            "checkout_verified": False,
            "fulfillment_verified": False,
            "external_demand_verified": False,
            "public_activation_authorized": False,
            "cube_worker_scaling_authorized": False,
            "cross_silo_data": False,
            "inventory_policy": "EMPTY_UNTIL_VERIFIED_SUPPLY_ATOM",
            "commercial_model": _commercial_model(silo),
            "capabilities_by_ref": silo.get("capabilities_by_ref", [
                "catalog", "compiler", "gauntlet", "commerce-spine", "fossil"
            ]),
            "do_not_copy": [
                "master inventory",
                "seller/customer records",
                "Stripe account or price IDs",
                "payment events",
                "identity and analytics identifiers",
                "other silo promotions",
            ],
            "activation_gates": [
                "runtime isolation and silo-specific RLS independently verified",
                "actual supply and buyer demand evidenced",
                "published route independently probed",
                "payment, attribution, refund, fulfillment, and delivery proof reconciled",
                "owner approves public activation and any scaling mutation",
            ],
        }
        if is_master:
            manifest["existing_master_references"] = {
                "manifest": "public/silos/mtg/silo.json",
                "catalog": "public/data/mtg-catalog.json",
                "surface": "public/mtg/index.html",
            }
            manifest["catalog_policy"] = "REFERENCE_EXISTING_MASTER_CATALOG; DO_NOT_COPY_INTO_CANDIDATE"
            files[f"{rel_root}/reference.html"] = _preview_html(silo)
        else:
            manifest["catalog_path"] = "catalog.json"
            manifest["catalog_policy"] = "NEW_EMPTY_CATALOG; NEVER COPY MTG OR OTHER SILO INVENTORY"
            catalog = {
                "schema": "dreamledger/cube-empty-catalog/v1",
                "silo": slug,
                "currency_default": "NZD",
                "status": "SCAFFOLD_ONLY_NOT_PROVISIONED",
                "products": [],
                "inventory_policy": "EMPTY_UNTIL_VERIFIED_SUPPLY_ATOM",
                "checkout_enabled": False,
                "verified_external_revenue_nzd": 0,
            }
            files[f"{rel_root}/catalog.json"] = _json(catalog)
            files[f"{rel_root}/preview.html"] = _preview_html(silo)
        files[f"{rel_root}/silo.json"] = _json(manifest)
        index_rows.append({
            "id": silo["id"],
            "slug": slug,
            "name": silo["name"],
            "status": manifest["status"],
            "priority": silo.get("priority"),
            "proposed_custom_domain": silo["proposed_custom_domain"],
            "domain_bound": False,
            "route_candidate": silo["route_candidate"],
            "scale_authorized": False,
        })

    files["manifest-index.json"] = _json({
        "schema": "dreamledger/cube-silo-scaffold-index/v1",
        "generated_at_utc": created,
        "master_silo": "mtg",
        "silo_count": len(index_rows),
        "candidate_scaffold_count": sum(1 for x in index_rows if x["slug"] != "mtg"),
        "registry_scope": "CONFIGURATION_ONLY_NOT_LIVE_TENANTS",
        "silos": index_rows,
        "verified_external_revenue_nzd": 0,
        "production_mutation": False,
        "dns_changed": False,
        "database_tenant_provisioning_performed": False,
        "production_workers_created": 0,
    })
    links = []
    for item in index_rows:
        leaf = "reference.html" if item["slug"] == "mtg" else "preview.html"
        links.append(
            '<li><a href="./silos/' + html.escape(item["slug"]) + '/' + leaf + '">' +
            html.escape(item["name"]) + '</a> <small>' +
            html.escape(item["status"]) + '</small></li>'
        )
    files["index.html"] = """<!doctype html>
<html lang="en-NZ"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>DreamLedger CUBE silo scaffold bundle</title>
<style>body{font:16px/1.5 system-ui,sans-serif;background:#0b0d12;color:#eef1f6;margin:0}
main{max-width:960px;margin:auto;padding:28px 18px 64px}li{padding:9px 0}a{color:#e8c87a}
small{color:#a8b1c2}</style></head><body><main>
<p>DreamLedger · CUBE · PRIVATE BUILD ARTIFACT</p>
<h1>Silo scaffold bundle</h1>
<p>These are candidate structures, not live stores. All candidate catalogs are empty.
No checkout, domain, public activation, or production worker was enabled.</p>
<ul>""" + "\n".join(links) + """</ul>
</main></body></html>
"""
    hashes = {
        path: hashlib.sha256(contents.encode("utf-8")).hexdigest()
        for path, contents in sorted(files.items())
    }
    files["bundle-proof.json"] = _json({
        "schema": "dreamledger/cube-silo-scaffold-proof/v1",
        "status": "SCAFFOLD_BUNDLE_GENERATED_NOT_PROVISIONED",
        "created_at_utc": created,
        "file_count_excluding_this_proof": len(files),
        "silo_count": len(index_rows),
        "candidate_scaffold_count": sum(1 for x in index_rows if x["slug"] != "mtg"),
        "sha256_by_path": hashes,
        "verified_external_revenue_nzd": 0,
        "dns_changed": False,
        "production_mutation": False,
        "database_tenant_provisioning_performed": False,
        "production_workers_created": 0,
    })
    return files


def validate_output_target(output_dir: Path) -> Path:
    target = output_dir.expanduser().resolve()
    root = repo_root()
    protected = (root / "public").resolve(), (root / "BEC-PRIME").resolve()
    if target == root or root in target.parents:
        for path in protected:
            if target == path or path in target.parents:
                raise ValueError(f"Refusing to generate scaffold output inside protected path: {target}")
        raise ValueError(f"Refusing to generate output inside repository: {target}")
    if target.exists() and any(target.iterdir()):
        raise ValueError(f"Output directory must be absent or empty: {target}")
    return target


def write_bundle(files: dict[str, str], output_dir: Path) -> None:
    for rel, contents in sorted(files.items()):
        target = output_dir / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(contents, encoding="utf-8", newline="\n")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--registry",
        default=str(repo_root() / "BEC-PRIME" / "cube" / "CUBE-SILO-REGISTRY.json"),
        help="Canonical CUBE silo registry JSON",
    )
    parser.add_argument(
        "--output-dir",
        required=True,
        help="New/empty output directory outside the repository's public/runtime paths",
    )
    args = parser.parse_args()
    try:
        registry = json.loads(Path(args.registry).read_text(encoding="utf-8-sig"))
        files = build_bundle(registry)
        target = validate_output_target(Path(args.output_dir))
        write_bundle(files, target)
        proof = json.loads((target / "bundle-proof.json").read_text(encoding="utf-8"))
    except Exception as exc:
        print(json.dumps({
            "status": "BLOCKED",
            "error_class": type(exc).__name__,
            "error": str(exc),
            "production_mutation": False,
            "dns_changed": False,
            "verified_external_revenue_nzd": 0,
        }, indent=2))
        return 2
    print(json.dumps({
        "status": proof["status"],
        "output_dir": str(target),
        "silo_count": proof["silo_count"],
        "candidate_scaffold_count": proof["candidate_scaffold_count"],
        "generated_files": proof["file_count_excluding_this_proof"] + 1,
        "production_mutation": False,
        "verified_external_revenue_nzd": 0,
    }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
