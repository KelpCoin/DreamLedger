from __future__ import annotations

import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PULSE = ROOT / "webapp" / "pulse"
RECEIPT_DIR = PULSE

def git_changed_files() -> list[str]:
    raw = subprocess.check_output(
        ["git", "status", "--porcelain", "--untracked-files=all"],
        cwd=ROOT,
        text=True,
    )
    return [line[3:] for line in raw.splitlines() if len(line) >= 4]

def verified_revenue() -> float:
    candidate = ROOT / "data" / "verified-revenue" / "latest.json"
    if not candidate.exists():
        return 0.0
    try:
        payload = json.loads(candidate.read_text(encoding="utf-8"))
        if payload.get("truth_status") != "VERIFIED":
            return 0.0
        amount = float(payload.get("amount_nzd") or 0.0)
        return amount if amount > 0 else 0.0
    except Exception:
        return 0.0

changed = git_changed_files()
revenue = verified_revenue()
# Public HTML and the stable machine-readable marketplace catalogue qualify as compounding artifacts.
# Internal JSON receipts remain internal evidence and never imply revenue.
artifact_files = [
    p for p in changed
    if (
        (p.startswith("webapp/pulse/") and p.lower().endswith(".html"))
        or (p.startswith("public/pulse/") and p.lower().endswith(".html"))
        or p in {"webapp/index.html", "webapp/phinhaven/index.html", "public/pulse/index.html", "agent-bridge-catalog.json"}
    )
]

# A no-op is accepted only when this exact workflow run emitted an explicit no-new-signal receipt.
# This prevents stale receipts from masking future generation failures.
noop_receipt = PULSE / "777-noop-receipt.json"
valid_noop = False
try:
    noop = json.loads(noop_receipt.read_text(encoding="utf-8"))
    current_run_id = os.environ.get("GITHUB_RUN_ID")
    valid_noop = bool(current_run_id) and noop.get("run_id") == current_run_id and noop.get("outcome") == "NO_NEW_SIGNAL_NO_NEW_COMPONENT" and noop.get("truth_status") == "UNVERIFIED"
except Exception:
    valid_noop = False

if revenue <= 0 and not artifact_files and not valid_noop:
    raise SystemExit(
        "777_COMPOUNDING_GATE=FAIL: cycle produced neither verified revenue evidence "
        "nor a new or changed public HTML artifact or current-run no-op receipt."
    )
if revenue <= 0 and not artifact_files and valid_noop:
    print("777_COMPOUNDING_GATE=PASS_NOOP")
    print("TRUTH_STATUS=UNVERIFIED")
    print("VERIFIED_REVENUE_NZD=0.00")
    print("ARTIFACT_COUNT=0")
    print("NOOP_REASON=No admissible new signal and no new bounded component; no duplicate public page emitted.")
    raise SystemExit(0)

now = datetime.now(timezone.utc)
receipt = {
    "schema": "dreamledger.777.compounding-receipt.v1",
    "observed_at": now.isoformat(),
    "truth_status": "VERIFIED" if revenue > 0 else "UNVERIFIED",
    "verified_revenue_nzd": revenue,
    "new_website_artifacts": sorted(artifact_files),
    "artifact_count": len(artifact_files),
    "rule": "VERIFIED_REVENUE_OR_DURABLE_PUBLIC_HTML",
    "economic_revenue_claim": revenue > 0,
}
target = RECEIPT_DIR / f"777-compounding-receipt-{now.strftime('%Y%m%dT%H%M%SZ')}.json"
target.write_text(json.dumps(receipt, indent=2, sort_keys=True) + "\n", encoding="utf-8")
print("777_COMPOUNDING_GATE=PASS")
print(f"TRUTH_STATUS={receipt['truth_status']}")
print(f"VERIFIED_REVENUE_NZD={revenue:.2f}")
print(f"ARTIFACT_COUNT={len(artifact_files)}")
print(f"RECEIPT={target.relative_to(ROOT).as_posix()}")
