#!/usr/bin/env python3
"""Read-only multi-silo commercial audit and 777 bounded research expeditions.

This compiler does not access the network, mutate prices, publish products, or
certify payments. It integrates with the existing scheduled 777 artifact path.
"""
import argparse
import hashlib
import json
from collections import Counter
from decimal import Decimal, InvalidOperation
from pathlib import Path

SILOS = ("mtg", "truth_oracle", "b2b", "billboard", "avatar", "kelphaven",
         "agent_bridge", "digital_tools", "marketplace")
LENSES = ("BUYER", "PROBLEM", "OFFER", "CHANNEL", "PRICE", "FULFILLMENT", "PROOF")
TRANSFORMS = ("NARROW", "BUNDLE", "SPLIT", "REPEAT", "MONITOR", "VERIFY", "BROKER")
GATES = ("DEMAND", "CAPABILITY", "ZERO_COST", "FULFILLMENT", "PAYMENT", "REPEAT", "CONTRADICTION")
DIFFERENTIATORS = ("SOURCE_PROVENANCE", "FIXED_SCOPE", "MEASURABLE_SAVINGS",
                   "LOW_TOUCH_DELIVERY", "LEGAL_REUSABILITY", "RETENTION",
                   "AUDITABLE_RECEIPT")
SOURCE_FILES = {
    "products": "BEC-PRIME/catalog/products",
    "fulfillment": "BEC-PRIME/fulfillment/PRODUCT-FULFILLMENT-REGISTRY.json",
    "approved": "BEC-PRIME/catalog/offers/approved.json",
    "truth_pricing": "BEC-PRIME/catalog/truth-oracle/pricing.json",
    "avatar_shadow": "IP/DreamMeez/shadow-cosmetics-20261028.json",
}
NO_ACTION = {"external_action": "BLOCKED", "public_post": False,
             "live_billing": False, "new_price": False,
             "deployment": False, "replication": False}


def read_json(path, warnings, fallback):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        warnings.append({"file": str(path), "issue": type(exc).__name__})
        return fallback


def cents(value, price_unit):
    if price_unit not in ("major", "minor") or isinstance(value, bool):
        return None
    try:
        v = Decimal(str(value))
        if not v.is_finite() or v < 0:
            return None
        out = v * (100 if price_unit == "major" else 1)
        if out != out.to_integral_value():
            return None
        return int(out)
    except (InvalidOperation, ValueError, TypeError):
        return None


def silo_of(product):
    source = str(product.get("silo", "")).lower()
    pid = str(product.get("id", "")).lower()
    if "dreamiez" in source or "dreammeez" in source or "dreamiez" in pid or "dreammeez" in pid:
        return "avatar"
    if source in ("mtg", "silo_mtg"): return "mtg"
    if "billboard" in source or "billboard" in pid: return "billboard"
    if "truth" in source: return "truth_oracle"
    if "kelp" in source: return "kelphaven"
    if source in SILOS: return source
    return "digital_tools"


def audit_products(root, warnings):
    registry = read_json(root / SOURCE_FILES["fulfillment"], warnings, {"entries": {}}).get("entries", {})
    offers = read_json(root / SOURCE_FILES["approved"], warnings, {"approved": []}).get("approved", [])
    approved = {x.get("product_id"): x for x in offers if isinstance(x, dict) and x.get("product_id")}
    rows = []
    product_dir = root / SOURCE_FILES["products"]
    for file in sorted(product_dir.glob("*.json")):
        product = read_json(file, warnings, {})
        if not isinstance(product, dict):
            warnings.append({"file": str(file), "issue": "NOT_OBJECT"})
            continue
        pid = product.get("id") or file.stem
        silo = silo_of(product)
        registry_entry = registry.get(pid, {})
        offer = approved.get(pid)
        reasons = []
        unit = product.get("price_unit")
        observed_cents = cents(product.get("price"), unit)
        if product.get("price") is not None and observed_cents is None:
            reasons.append("PRICE_UNIT_MISSING_OR_INVALID")
        if offer:
            offer_cents = cents(offer.get("price"), "major")
            if observed_cents is not None and offer_cents is not None and observed_cents != offer_cents:
                reasons.append("OFFER_SOURCE_PRICE_CONFLICT")
            if str(offer.get("silo", "")).lower() not in (str(product.get("silo", "")).lower(), silo):
                reasons.append("OFFER_SILO_CONFLICT")
        if product.get("status") == "published" and not registry_entry.get("ready", False):
            reasons.append("PUBLISHED_WITHOUT_REGISTRY_READY")
        if product.get("status") == "published" and not offer:
            reasons.append("PUBLISHED_NO_APPROVED_OFFER")
        if registry_entry.get("ready") is True and (
            product.get("status") in ("held", "review_required") or
            product.get("checkout", {}).get("mode") == "disabled" or
            product.get("checkout", {}).get("enabled") is False
        ):
            reasons.append("REGISTRY_READY_BUT_PRODUCT_HELD")
        if offer and registry_entry.get("ready") is True:
            delivery = str(offer.get("fulfillment_route", "")).lower()
            if "manual" in delivery and "automatic" in str(registry_entry.get("type", "")).lower():
                reasons.append("MANUAL_AUTOMATION_CONFLICT")
        if silo == "avatar":
            provenance = product.get("artwork_provenance", {})
            if not (isinstance(provenance, dict) and provenance.get("original_sketch_sha256")
                    and provenance.get("artist_approved") is True):
                reasons.append("AVATAR_ARTWORK_PROVENANCE_UNVERIFIED")
            if product.get("status") == "published" and product.get("commercial_truth", {}).get("approval_required") is False:
                reasons.append("AVATAR_APPROVAL_GATE_MISSING")
        # Explicit policy: no inferred change to prices, checkout, product or entitlement.
        rows.append({
            "product_id": pid, "silo": silo, "source_file": str(file.relative_to(root)),
            "published_in_source": product.get("status") == "published",
            "source_status": product.get("status", "UNKNOWN"),
            "source_price_minor_units": observed_cents,
            "price_unit": unit or "UNSPECIFIED",
            "approved_offer_id": offer.get("offer_id") if offer else None,
            "registry_claims_ready": registry_entry.get("ready") is True,
            "fulfillment_mode": registry_entry.get("type", "UNKNOWN"),
            "validation": "HOLD" if reasons else "REVIEW_REQUIRED",
            "reasons": sorted(set(reasons)),
            "gold_mode": "HOLD_PENDING_INDEPENDENT_PAYMENT_DELIVERY_COST_RIGHTS_PROOF",
            "auto_pricing": "RESEARCH_ONLY_NO_STRIPE_MUTATION",
            "commercial_actions": dict(NO_ACTION),
        })
    return rows


def expeditions(count=777):
    if count != 777:
        raise ValueError("The bounded portfolio requires exactly 777 research candidates")
    all_candidates = []
    for silo in SILOS:
        cohort = []
        for lens in LENSES:
            for transform in TRANSFORMS:
                for gate in GATES:
                    key = silo + "|" + lens + "|" + transform + "|" + gate
                    digest = hashlib.sha256(key.encode()).hexdigest()
                    cohort.append((digest, silo, lens, transform, gate))
        cohort.sort()
        all_candidates.append(cohort)
    out = []
    # Balanced allocation: 87 candidates in three silos, 86 in six.
    for i in range(count):
        cohort = all_candidates[i % len(all_candidates)]
        digest, silo, lens, transform, gate = cohort[i // len(all_candidates)]
        out.append({
            "expedition_id": "MS777-" + digest[:16],
            "silo": silo, "lens": lens, "transform": transform, "gate": gate,
            "differentiator": DIFFERENTIATORS[i % len(DIFFERENTIATORS)],
            "status": "RESEARCH_HYPOTHESIS_ONLY",
            "buyer_evidence": "NOT_LINKED",
            "fulfillment": "UNVERIFIED",
            "margin": "UNKNOWN",
            "pricing": "NO_AUTOMATIC_REPRICING",
            "gold_mode": "HOLD",
            "approval": "REQUIRED_FOR_ANY_EXTERNAL_ACTION",
            "commercial_actions": dict(NO_ACTION),
        })
    return out


def compile_portfolio(root):
    root = Path(root)
    warnings = []
    products = audit_products(root, warnings)
    expeditions_list = expeditions()
    by_silo = dict(sorted(Counter(p["silo"] for p in products).items()))
    anomalies = [p for p in products if p["reasons"]]
    shadow = read_json(root / SOURCE_FILES["avatar_shadow"], warnings, {"items": []})
    pricing = read_json(root / SOURCE_FILES["truth_pricing"], warnings, {"plans": []})
    return {
        "schema": "DREAMLEDGER/MULTISILO-777-READINESS/v1",
        "mode": "CLOUD_RESEARCH_ONLY",
        "authority": "Existing CUBE/Elohim/Gauntlet remain canonical; this is a passive proof compiler",
        "scope": "Source registry and policy audit, NOT provider-backed settlement or delivery verification",
        "generation": "DETERMINISTIC_NO_TIMESTAMP",
        "product_count": len(products),
        "products_by_silo": by_silo,
        "products_with_source_conflicts": len(anomalies),
        "avatar_shadow_candidate_count": len(shadow.get("items", [])),
        "truth_oracle_configured_paid_tier_count": sum(
            1 for p in pricing.get("plans", []) if p.get("stripe_price_id")),
        "price_policy": {
            "source_prices_only": True,
            "auto_pricing_mode": "SHADOW_ONLY",
            "pricing_inputs_required": ["provider_price_active", "unit_explicit",
                "direct_cost_proven", "customer_willingness_to_pay_evidence",
                "human_price_change_approval"],
            "mutable_stripe_prices": False,
        },
        "gold_mode": {
            "definition": "Commercial graduation requires independently evidenced real buyer, settled attributable payment, real delivery, customer acceptance, costs and rights",
            "enabled": False, "graduated_skus": [],
            "external_claims": "NONE",
        },
        "source_files": SOURCE_FILES,
        "warnings": warnings,
        "products": products,
        "expedition_count": len(expeditions_list),
        "expedition_silos": dict(sorted(Counter(x["silo"] for x in expeditions_list).items())),
        "expeditions": expeditions_list,
        "economic_truth": {
            "verified_new_external_sales": "NOT_ASSESSED",
            "independent_payment_reconciliation": "REQUIRED",
            "provider_fulfillment_reconciliation": "REQUIRED",
        },
        "global_commercial_actions": dict(NO_ACTION),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument("--output", type=Path, default=None)
    args = parser.parse_args()
    report = compile_portfolio(args.root)
    serialized = json.dumps(report, ensure_ascii=True, sort_keys=True, indent=2) + "\n"
    if args.output:
        output = args.output if args.output.is_absolute() else Path.cwd() / args.output
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(serialized, encoding="utf-8")
    print(json.dumps({
        "schema": report["schema"], "product_count": report["product_count"],
        "products_with_source_conflicts": report["products_with_source_conflicts"],
        "expeditions": report["expedition_count"],
        "gold_mode_enabled": report["gold_mode"]["enabled"],
        "external_action": report["global_commercial_actions"]["external_action"],
        "sha256": hashlib.sha256(serialized.encode()).hexdigest(),
    }, sort_keys=True))


if __name__ == "__main__":
    main()
