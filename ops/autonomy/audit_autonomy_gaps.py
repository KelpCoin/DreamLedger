#!/usr/bin/env python3
"""
Air-gap autonomy gap auditor for DreamLedger / BEC.

Run from repo root or pass --root.
Does not call Stripe, does not claim revenue, does not need secrets.

  python ops/autonomy/audit_autonomy_gaps.py
  python ops/autonomy/audit_autonomy_gaps.py --root D:\\path\\to\\DreamLedger

Writes:
  ops/autonomy/LAST-GAP-AUDIT.json
  ops/autonomy/LAST-GAP-AUDIT.md
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path


def exists(root: Path, rel: str) -> bool:
    return (root / rel).is_file() or (root / rel).is_dir()


def read_json(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as e:
        return {"_error": str(e)}


def main() -> int:
    ap = argparse.ArgumentParser(description="Audit gaps to autonomous revenue engine")
    ap.add_argument("--root", type=str, default=".", help="Repo root")
    args = ap.parse_args()
    root = Path(args.root).resolve()

    checks = []

    def add(gap_id: str, name: str, severity: str, ok: bool, detail: str, plug: str):
        checks.append(
            {
                "id": gap_id,
                "name": name,
                "severity": severity,
                "present_or_ok": ok,
                "detail": detail,
                "how_to_plug": plug,
            }
        )

    # --- Structural (software on disk) ---
    add(
        "S1",
        "Settlement workflow",
        "critical",
        exists(root, ".github/workflows/commerce-settlement-sync.yml"),
        "commerce-settlement-sync.yml",
        "Already expected on main; restore from git if missing",
    )
    add(
        "S2",
        "Reconcile script",
        "critical",
        exists(root, "ops/commerce/reconcile-stripe-airtable.mjs"),
        "ops/commerce/reconcile-stripe-airtable.mjs",
        "Restore from git; do not put secrets in the file",
    )
    add(
        "S3",
        "Approved offers catalog",
        "critical",
        exists(root, "BEC-PRIME/catalog/offers/approved.json"),
        "approved.json",
        "Keep Payment Link IDs aligned with live Stripe",
    )
    add(
        "S4",
        "Fulfillment registry",
        "critical",
        exists(root, "BEC-PRIME/fulfillment/PRODUCT-FULFILLMENT-REGISTRY.json"),
        "PRODUCT-FULFILLMENT-REGISTRY.json",
        "Only sell products with ready=true and operator_required=false for autonomy",
    )
    add(
        "S5",
        "Economic loop registry",
        "high",
        exists(root, "BEC-PRIME/economic-loops/registry.json"),
        "registry.json",
        "Register new loops only after approval + payment config",
    )
    add(
        "S6",
        "Demand sentinel contract",
        "medium",
        exists(root, "BEC-PRIME/sentinels/DEMAND-SENTINEL.md"),
        "Demand sentinel docs",
        "Wire feeds → DemandNotes when online",
    )
    add(
        "S7",
        "Intent-to-pay sentinel contract",
        "medium",
        exists(root, "BEC-PRIME/sentinels/INTENT-TO-PAY-SENTINEL.md"),
        "Intent sentinel docs",
        "Wire checkout open/abandon only; paid stays on settlement path",
    )
    add(
        "S8",
        "DemandRadar runtime",
        "medium",
        exists(root, "BEC-PRIME/runtime/DemandRadar.js"),
        "DemandRadar.js",
        "Call record() from face/runtime hooks",
    )
    add(
        "S9",
        "BEC compiler control plane",
        "medium",
        exists(root, "BEC-PRIME/bec.js") or exists(root, "BEC-PRIME/COMPILER-CONTROL-PLANE.md"),
        "bec.js / control plane",
        "Prefer compile → deploy over permanent hand-edited public HTML",
    )
    add(
        "S10",
        "Autonomy truth contract",
        "low",
        exists(root, "BEC-PRIME/docs/BECK-AUTONOMY-TRUTH-CONTRACT.md"),
        "Truth contract present",
        "Do not claim LOCAL autonomy proven without evidence",
    )

    # --- Catalog truth ---
    approved_path = root / "BEC-PRIME/catalog/offers/approved.json"
    approved = read_json(approved_path) if approved_path.is_file() else {}
    offers = approved.get("approved") if isinstance(approved, dict) else None
    n_approved = len(offers) if isinstance(offers, list) else 0
    add(
        "C1",
        "Approved offer count",
        "critical",
        n_approved >= 1,
        f"approved offers: {n_approved}",
        "At least one live Payment Link offer must stay in approved.json",
    )

    ful_path = root / "BEC-PRIME/fulfillment/PRODUCT-FULFILLMENT-REGISTRY.json"
    ful = read_json(ful_path) if ful_path.is_file() else {}
    entries = ful.get("entries") if isinstance(ful, dict) else {}
    auto_ready = []
    if isinstance(entries, dict):
        for k, v in entries.items():
            if isinstance(v, dict) and v.get("ready") is True and v.get("operator_required") is False:
                auto_ready.append(k)
    add(
        "C2",
        "Zero-human fulfilment products",
        "critical",
        len(auto_ready) >= 1,
        f"auto-ready: {auto_ready}",
        "Only these can participate in unattended fulfilment",
    )

    loop_path = root / "BEC-PRIME/economic-loops/registry.json"
    loops = read_json(loop_path) if loop_path.is_file() else {}
    rev = loops.get("verified_external_revenue_nzd") if isinstance(loops, dict) else None
    add(
        "C3",
        "Revenue meter honesty",
        "critical",
        True,  # presence of field is informational
        f"registry verified_external_revenue_nzd={rev}",
        "Never bump without Stripe live + fossil; external demand is G1",
    )

    # --- Operator-only gaps (cannot verify offline) ---
    operator_gaps = [
        {
            "id": "G1",
            "name": "External demand (paying strangers)",
            "severity": "critical",
            "present_or_ok": False,
            "detail": "Cannot be verified from repo alone; meter still expected NZ$0 until first external pay",
            "how_to_plug": "Post share pack; Truth Oracle content; owned channels; agents later",
        },
        {
            "id": "G2",
            "name": "GitHub Actions STRIPE_SECRET_KEY",
            "severity": "critical",
            "present_or_ok": False,
            "detail": "Secret must not appear in git; verify in repo Settings → Secrets",
            "how_to_plug": "Add live STRIPE_SECRET_KEY; never commit it",
        },
        {
            "id": "G3",
            "name": "Settlement Sync green run",
            "severity": "critical",
            "present_or_ok": False,
            "detail": "Run workflow_dispatch Commerce Settlement Sync; expect 0 sessions pre-sale",
            "how_to_plug": "Actions tab → Commerce Settlement Sync → Run workflow",
        },
        {
            "id": "G4",
            "name": "Stripe webhook → production",
            "severity": "critical",
            "present_or_ok": False,
            "detail": "Signed webhook required for unattended billboard fulfilment",
            "how_to_plug": "Stripe Dashboard → webhook to Render URL + STRIPE_WEBHOOK_SECRET on host",
        },
        {
            "id": "G6",
            "name": "Demand/Intent feed wiring",
            "severity": "medium",
            "present_or_ok": False,
            "detail": "Contracts exist; live pipes usually not connected",
            "how_to_plug": "Append DemandNotes/IntentNotes from analytics and checkout-open events",
        },
        {
            "id": "G8",
            "name": "Local multi-LLM autonomy",
            "severity": "medium",
            "present_or_ok": False,
            "detail": "BECK-AUTONOMY-TRUTH-CONTRACT: LOCAL_AUTONOMY_UNPROVEN",
            "how_to_plug": "LM Studio + workers + observed second cycle with evidence",
        },
    ]

    structural_fail = [c for c in checks if not c["present_or_ok"]]
    report = {
        "schema": "BEC-PRIME/AUTONOMY-GAP-AUDIT/v1",
        "audited_at": datetime.now(timezone.utc).isoformat(),
        "repo_root": str(root),
        "policy": "This audit never declares a sale. BusinessTruth requires external buyer + live Stripe + fulfilment + evidence.",
        "structural_checks": checks,
        "structural_failures": structural_fail,
        "operator_gaps_unverified_offline": operator_gaps,
        "auto_ready_fulfillment_keys": auto_ready,
        "approved_offer_count": n_approved,
        "next_human_actions": [
            "Confirm STRIPE_SECRET_KEY in GitHub Actions secrets",
            "Run Commerce Settlement Sync once; archive artifact",
            "Confirm Stripe webhook endpoint + signing secret on production",
            "Distribute Payment Links (demand)",
            "On first live pay: verify fulfilment proof then update loop registry",
        ],
        "verdict": {
            "fully_autonomous_revenue_engine": False,
            "reason": "External demand + live secrets/webhooks + observed settlement cannot be certified from an air-gap repo audit alone",
            "software_scaffolding": "PASS" if not structural_fail else "FAIL",
        },
    }

    out_dir = root / "ops" / "autonomy"
    out_dir.mkdir(parents=True, exist_ok=True)
    json_path = out_dir / "LAST-GAP-AUDIT.json"
    md_path = out_dir / "LAST-GAP-AUDIT.md"
    json_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")

    lines = [
        f"# Autonomy gap audit",
        f"",
        f"Audited: `{report['audited_at']}`",
        f"Root: `{root}`",
        f"",
        f"## Verdict",
        f"",
        f"- Fully autonomous revenue engine: **{report['verdict']['fully_autonomous_revenue_engine']}**",
        f"- Software scaffolding: **{report['verdict']['software_scaffolding']}**",
        f"- Reason: {report['verdict']['reason']}",
        f"",
        f"## Structural checks",
        f"",
    ]
    for c in checks:
        mark = "OK" if c["present_or_ok"] else "MISSING"
        lines.append(f"- **{c['id']}** [{mark}] {c['name']} — {c['detail']}")
    lines.extend(["", "## Operator gaps (verify outside git)", ""])
    for g in operator_gaps:
        lines.append(f"- **{g['id']}** {g['name']}: {g['how_to_plug']}")
    lines.extend(["", "## Next human actions", ""])
    for a in report["next_human_actions"]:
        lines.append(f"- [ ] {a}")
    lines.append("")
    md_path.write_text("\n".join(lines), encoding="utf-8")

    print(json.dumps({"wrote": [str(json_path), str(md_path)], "verdict": report["verdict"]}, indent=2))
    return 0 if not structural_fail else 2


if __name__ == "__main__":
    sys.exit(main())
