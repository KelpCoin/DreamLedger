#!/usr/bin/env python3
"""Economically audit the checked-out DreamLedger sources against a sanitized Stripe snapshot.

This is a local, repeatable validator. It makes no API calls and changes no production state.
A BLOCKED result is an auditable outcome, not a failed script execution.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_SNAPSHOT = ROOT / "ops" / "economics" / "stripe-live-evidence-2026-10-20.json"


def read_json(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"Expected a JSON object: {path}")
    return value


def read_text(root: Path, relative: str) -> str:
    path = root / relative
    try:
        return path.read_text(encoding="utf-8-sig")
    except OSError:
        return ""


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def add_finding(findings: list[dict[str, Any]], finding_id: str, severity: str,
                status: str, title: str, evidence: list[str], required_action: str) -> None:
    findings.append({
        "id": finding_id,
        "severity": severity,
        "status": status,
        "title": title,
        "evidence": evidence,
        "required_action": required_action,
    })


def build_audit(root: Path = ROOT, snapshot_path: Path = DEFAULT_SNAPSHOT) -> dict[str, Any]:
    snapshot = read_json(snapshot_path)
    product = read_json(root / "BEC-PRIME/catalog/products/COMMANDER-DECK-DIAGNOSTIC-001.json")
    registry = read_json(root / "BEC-PRIME/fulfillment/PRODUCT-FULFILLMENT-REGISTRY.json")
    billboard = read_text(root, "public/billboard.html")
    revenue_ledger = read_text(root, "BEC-PRIME/lib/revenueLedger.js")
    start_js = read_text(root, "BEC-PRIME/start.js")
    commander_worker = read_text(root, "workers/marketplace/commander_marketplace_worker.py")
    findings: list[dict[str, Any]] = []

    inspected = {x.get("offer_key"): x for x in snapshot.get("inspected_offers", [])}
    billboard_offer = inspected.get("billboard_founding_50", {})
    mtg_offer = inspected.get("commander_deck_diagnostic_29", {})
    dreamiez_offer = inspected.get("dreammeez_supporter_sprout", {})
    product_registry = registry.get("entries", {}).get("COMMANDER-DECK-DIAGNOSTIC-001", {})

    cta_url = billboard_offer.get("public_cta_url")
    billboard_active = billboard_offer.get("stripe_link_active") is True
    if cta_url and cta_url in billboard and not billboard_active:
        add_finding(
            findings, "BILLBOARD-CTA-INACTIVE-LIVE-LINK", "CRITICAL", "BLOCKED",
            "Billboard public CTA points at an inactive Stripe Payment Link",
            [
                "public/billboard.html contains the exact URL recorded in the read-only Stripe snapshot.",
                f"Stripe link ID: {billboard_offer.get('stripe_payment_link_id')}.",
                "The public page also says checkout is live, which contradicts the provider object's active=false state."
            ],
            "Before distribution, verify the replacement link and exact NZ$50 price, then independently verify buyer input, reservation, review, publication and durable proof. Do not simply swap URLs."
        )

    mtg_status = product.get("status")
    mtg_checkout = (product.get("checkout") or {}).get("mode")
    mtg_fulfillment = product.get("fulfillment") or {}
    registry_ready = product_registry.get("ready") is True
    if (
        mtg_offer.get("stripe_link_active") is True
        and (mtg_status != "published" or mtg_checkout == "disabled" or mtg_fulfillment.get("mode") == "disabled")
        and registry_ready
    ):
        add_finding(
            findings, "MTG-STRIPE-CATALOG-FULFILLMENT-CONFLICT", "CRITICAL", "BLOCKED",
            "Commander diagnostic link, product manifest and fulfillment registry disagree",
            [
                f"Repository product status={mtg_status!r}; checkout.mode={mtg_checkout!r}.",
                f"Repository product fulfillment.mode={mtg_fulfillment.get('mode')!r}; operator_required={mtg_fulfillment.get('operator_required')!r}.",
                f"Fulfillment registry says ready={product_registry.get('ready')!r}, operator_required={product_registry.get('operator_required')!r}.",
                "The inspected NZ$29 Stripe link is active and its confirmation message tells buyers to reply with a decklist if they have not supplied one."
            ],
            "Reconcile product status, checkout eligibility and the actual delivery contract. Keep the link unpublished or disabled until signed settlement, intake, idempotent fulfillment and retrievable delivery proof pass end-to-end."
        )

    if dreamiez_offer.get("stripe_link_active") is True and not dreamiez_offer.get("end_to_end_fulfillment_proof"):
        add_finding(
            findings, "DREAMIEZ-COSMETIC-E2E-NOT-PROVEN", "HIGH", "NEXT_TEST_CANDIDATE",
            "DreamMeez has an active NZ$3.99 link but no end-to-end entitlement proof in the evidence snapshot",
            [
                f"Inspected payment link ID: {dreamiez_offer.get('stripe_payment_link_id')}.",
                "Stripe line item was observed as NZD 399 minor units.",
                "An active provider link and product metadata do not prove account-bound entitlement delivery."
            ],
            "Run one test-mode signed-webhook path through an idempotent account entitlement, receipt, replay test and user-visible read-back before treating this as sellable."
        )

    if "fs.appendFileSync" in revenue_ledger and "eventAlreadyProcessed" in revenue_ledger:
        add_finding(
            findings, "LEDGER-READ-THEN-APPEND-RACE", "HIGH", "BLOCKED_FOR_CONCURRENT_PRODUCTION",
            "File-backed JSONL idempotency is not a transactional uniqueness constraint",
            [
                "BEC-PRIME/lib/revenueLedger.js persists event, journal, entry and fulfillment records to local JSONL files.",
                "recordEvent checks eventAlreadyProcessed and then appends; concurrent handlers can race between check and append.",
                "appendUnique is also a read-before-append sequence and has no cross-process atomic uniqueness guarantee."
            ],
            "Move authoritative idempotency keys, settlement, deferred revenue, fulfillment state and event outbox into a transactional durable database with unique constraints; test concurrent duplicate delivery and crash recovery."
        )

    if "SUPABASE_URL" in commander_worker and "SUPABASE_SERVICE_ROLE_KEY" in commander_worker and "marketplace-fulfillment" in commander_worker:
        add_finding(
            findings, "MTG-WORKER-REQUIRES-SUPABASE-AND-STORAGE", "HIGH", "MIGRATION_BLOCKER",
            "The Commander fulfillment worker still depends on Supabase RPC and Storage",
            [
                "workers/marketplace/commander_marketplace_worker.py requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
                "It polls claim/complete/fail RPCs, writes a local cache/report, and uploads to the marketplace-fulfillment Storage bucket.",
                "A source file is not proof of a live queue consumer or a deployed worker fleet."
            ],
            "Provision and test a durable database/storage adapter on the intended replacement stack, then prove queue claim fencing, restart durability, delivery checksum and failure retry without relying on local ephemeral disk."
        )

    if "http.createServer" in start_js and ("fs.appendFileSync" in revenue_ledger or "fs.writeFileSync" in revenue_ledger):
        add_finding(
            findings, "CLOUDFLARE-STATEFUL-RUNTIME-NOT-PORTABLE", "HIGH", "MIGRATION_BLOCKER",
            "The current stateful runtime is not a drop-in Cloudflare Worker",
            [
                "BEC-PRIME/start.js uses Node http.createServer.",
                "The revenue ledger persists authoritative state in local files.",
                "Stateful checkout and settlement routes must use a Workers-compatible handler and durable storage before DNS cutover."
            ],
            "Implement and test a Worker/Pages Functions entrypoint against durable Neon-backed repositories, then pass route, persistence, Stripe test-mode and commit-SHA acceptance before production cutover."
        )

    catalog_sample = snapshot.get("catalog_sample", {})
    products_sample = catalog_sample.get("products_first_page", {})
    candidate_active_count = products_sample.get("active")
    has_more = products_sample.get("has_more")
    if candidate_active_count is not None:
        add_finding(
            findings, "STRIPE-ACTIVE-IS-NOT-SELLABLE", "MEDIUM", "CONTROL_REQUIRED",
            "Stripe active flags and catalog size cannot be used as a sellability score",
            [
                f"The first {products_sample.get('returned')} product objects returned {candidate_active_count} active and {products_sample.get('inactive')} inactive records.",
                "The snapshot notes many active M10K service-wall records carry status CANDIDATE.",
                f"The page was truncated (has_more={has_more}); the result is not the full inventory."
            ],
            "Reconcile each public SKU against approval state, correct price/currency, active link, supported runtime, intake, fulfillment proof and measured demand. Keep candidates held."
        )

    charges = snapshot.get("account_level_settlement_evidence", {})
    if charges.get("successful_paid_charges", 0) and not charges.get("include_in_verified_dreamledger_revenue"):
        add_finding(
            findings, "STRIPE-CHARGES-UNATTRIBUTED", "HIGH", "NOT_VERIFIED_REVENUE",
            "Historical account charges do not qualify as verified DreamLedger revenue",
            [
                f"Read-only snapshot returned {charges.get('successful_paid_charges')} successful paid charges.",
                f"Original-currency amounts: {charges.get('original_currency_gross')}.",
                f"Balance transactions convert to NZD minor units: gross={charges.get('converted_gross_minor_nzd')}, fees={charges.get('fees_minor_nzd')}, net={charges.get('net_minor_nzd')}.",
                "The returned charge records lacked useful product/offer attribution and no independent fulfillment proof was joined."
            ],
            "Keep verified revenue at NZ$0 until each transaction has canonical offer attribution, independent settlement, fulfillment and retrievable delivery evidence."
        )

    missing_modules = snapshot.get("repository_evidence", {}).get("missing_claimed_modules_in_dreamledger_main", [])
    if missing_modules:
        add_finding(
            findings, "CUBE-SPAWNER-SOURCE-NOT-VERIFIED", "HIGH", "SOURCE_UNVERIFIED",
            "Named autoscaler, tenant spawner and rebuilt engine were not inspectable in checked DreamLedger main paths",
            [f"Not found at the checked repository paths: {', '.join(missing_modules)}."],
            "Attach the exact source files or commit them to the controlled branch, then test them against a real queue, durable fencing store, cost ledger and production evidence. Do not accept throughput stdout as a deployed-fleet benchmark."
        )

    if len(findings) == 0:
        add_finding(
            findings, "NO_FINDINGS", "INFO", "REVIEW",
            "No known mismatches were identified by this static audit",
            ["A clean static audit is not proof of a live payment or fulfillment."],
            "Run authenticated end-to-end tests before declaring readiness."
        )

    blockers = [x for x in findings if x["severity"] in ("CRITICAL", "HIGH") and x["status"] in ("BLOCKED", "BLOCKED_FOR_CONCURRENT_PRODUCTION", "MIGRATION_BLOCKER", "NOT_VERIFIED_REVENUE", "SOURCE_UNVERIFIED")]
    readiness = {
        "mtg_master": "BLOCKED" if any(x["id"].startswith("MTG-") for x in findings) else "NOT_ACCEPTED",
        "billboard_nzd_50": "BLOCKED" if any(x["id"] == "BILLBOARD-CTA-INACTIVE-LIVE-LINK" for x in findings) else "NOT_ACCEPTED",
        "dreamiez_cosmetics": "NEXT_TEST_CANDIDATE_NOT_ACCEPTED" if any(x["id"] == "DREAMIEZ-COSMETIC-E2E-NOT-PROVEN" for x in findings) else "NOT_ACCEPTED",
        "cloudflare_stateful_commerce": "BLOCKED" if any(x["id"] == "CLOUDFLARE-STATEFUL-RUNTIME-NOT-PORTABLE" for x in findings) else "NOT_ACCEPTED",
        "cube_swarm_production": "NOT_VERIFIED_NO_SCALE_AUTHORIZED",
        "candidate_silo_manifests": "READY_TO_GENERATE_NOT_PROVISIONED"
    }
    snapshot_bytes = snapshot_path.read_bytes()
    files = [
        "BEC-PRIME/catalog/products/COMMANDER-DECK-DIAGNOSTIC-001.json",
        "BEC-PRIME/fulfillment/PRODUCT-FULFILLMENT-REGISTRY.json",
        "public/billboard.html",
        "BEC-PRIME/lib/revenueLedger.js",
        "BEC-PRIME/start.js",
        "workers/marketplace/commander_marketplace_worker.py"
    ]
    source_hashes = {}
    for rel in files:
        p = root / rel
        if p.exists():
            source_hashes[rel] = sha256_bytes(p.read_bytes())

    return {
        "schema": "dreamledger/economic-readiness-audit/v1",
        "status": "BLOCKED" if blockers else "REVIEW",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "input_snapshot_date": snapshot.get("observed_date"),
        "input_snapshot_sha256": sha256_bytes(snapshot_bytes),
        "source_file_sha256": source_hashes,
        "economic_truth": {
            "verified_revenue_nzd": 0,
            "account_level_charge_count": charges.get("successful_paid_charges", 0),
            "account_level_net_balance_nzd": charges.get("net_minor_nzd", 0) / 100,
            "account_level_net_is_verified_revenue": False,
            "simulation_value_nzd": 0,
            "deployed_cube_workers_verified": 0
        },
        "readiness": readiness,
        "finding_count": len(findings),
        "blocking_finding_count": len(blockers),
        "findings": findings,
        "production_mutations_performed": False,
        "dns_changed": False,
        "stripe_changed": False,
        "database_changed": False,
        "workers_provisioned": 0,
        "scale_up_enabled": False,
        "limitation": "This report uses the committed read-only Stripe snapshot and checked-out source code. It does not make live API calls or prove later provider state. Re-run provider probes before any release."
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("--snapshot", type=Path, default=DEFAULT_SNAPSHOT)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--require-ready", action="store_true",
                        help="Return exit code 3 while any economic or migration blocker remains.")
    args = parser.parse_args()
    try:
        audit = build_audit(args.root.resolve(), args.snapshot.resolve())
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(json.dumps({"status": "ERROR", "error": str(exc)}, indent=2), file=sys.stderr)
        return 2
    serialized = json.dumps(audit, indent=2, ensure_ascii=False) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(serialized, encoding="utf-8")
    print(json.dumps({
        "status": audit["status"],
        "verified_revenue_nzd": audit["economic_truth"]["verified_revenue_nzd"],
        "blocking_finding_count": audit["blocking_finding_count"],
        "readiness": audit["readiness"],
        "output": str(args.output) if args.output else None
    }, indent=2))
    if args.require_ready and audit["status"] == "BLOCKED":
        return 3
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
