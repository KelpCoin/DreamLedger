#!/usr/bin/env python3
"""Secret-free static contract checks for DreamLedger's existing paid quote path.

These checks prevent accidental removal of key eligibility guards. They do not
prove runtime behavior, database availability, Stripe settlement, or delivery.
"""
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
INTAKE = ROOT / "supabase/functions/quote-intake/index.ts"
WORKER = ROOT / "supabase/functions/quote-fulfillment/index.ts"
WORKFLOW = ROOT / ".github/workflows/777-cycle.yml"

def require(label: str, condition: bool) -> None:
    print(f"[[32mPASS[0m] {label}" if condition else f"[[31mFAIL[0m] {label}")
    if not condition:
        failures.append(label)

failures = []
if not INTAKE.is_file() or not WORKER.is_file() or not WORKFLOW.is_file():
    print("[FAIL] Required quote path/workflow source file missing")
    sys.exit(1)

intake = INTAKE.read_text(encoding="utf-8")
worker = WORKER.read_text(encoding="utf-8")
workflow = WORKFLOW.read_text(encoding="utf-8")

# The public intake endpoint must independently retrieve and validate the
# Stripe session, rather than trusting browser-supplied payment claims.
require("Stripe Checkout Session retrieved server-side",
        "stripe.checkout.sessions.retrieve(sessionId)" in intake)
require("live mode required for current live offer",
        'session.livemode!==true' in intake)
require("settled/paid Checkout Session required",
        'session.payment_status!=="paid"' in intake)
require("expected Payment Link enforced",
        "session.payment_link!==PAYMENT_LINK" in intake)
require("expected SKU metadata enforced",
        "session.metadata?.sku_id!==SKU" in intake and "session.metadata?.dreamledger_sku!==SKU" in intake)
require("settlement/order ledger record required",
        'from("revenue_orders")' in intake and '"SETTLEMENT_RECORD_PENDING"' in intake)
require("entitlement record required",
        'from("revenue_entitlements")' in intake and '"ENTITLEMENT_PENDING"' in intake)
require("fulfillment request required before inputs accepted",
        'from("fulfillment_requests")' in intake and '"FULFILLMENT_REQUEST_NOT_FOUND"' in intake)
require("file paths scoped to the paid order",
        'quote-inputs/${ctx.order.id}/' in intake)
require("input types and size bounded",
        "MAX_BYTES=10*1024*1024" in intake and '["pdf","csv","json","md"]' in intake)

# The worker must not turn incomplete extraction into a completed comparison,
# and its evidence state must remain explicit rather than falsely verified.
require("partial/review-needed comparison is not marked fulfilled",
        'summary.comparison_status==="REVIEW_NEEDED"||summary.comparison_status==="PARTIAL"' in worker)
require("worker leaves evidence unverified pending verification",
        'evidence_status:"UNVERIFIED"' in worker)
require("worker does not declare verified evidence",
        "evidence_status:" + chr(34) + "VERIFIED" + chr(34) not in worker and "evidence_status:'VERIFIED'" not in worker)
require("worker requires finalized quote inputs",
        "INPUTS_NOT_READY" in worker and "input_files" in worker)

# Keep the cycle cloud-hosted. This check is a policy guard, not a runner health
# test. A workstation being offline must not be misrepresented as cloud failure.
require("economic cycle remains GitHub-hosted",
        "runs-on: ubuntu-latest" in workflow and "runs-on: [self-hosted" not in workflow)

print(f"\nQUOTE_PATH_STATIC_CONTRACT={'FAIL' if failures else 'PASS'}")
print("LIMITATION=Static source checks only; no database, Stripe, deployment, or payment was exercised.")
if failures:
    print("Failed checks: " + ", ".join(failures))
    sys.exit(1)
