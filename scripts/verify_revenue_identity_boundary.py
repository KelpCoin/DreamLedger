#!/usr/bin/env python3
"""Fail-closed identity/authority boundary for the first-dollar commercial path."""
from pathlib import Path
import sys

ROOT=Path(__file__).resolve().parents[1]
TRUTH=ROOT/"supabase/functions/truth-oracle-execute/index.ts"
SETTLEMENT=ROOT/"supabase/functions/stripe-revenue-41104f355d6878cdd6d1f9dc/index.ts"
INTAKE=ROOT/"supabase/functions/quote-intake/index.ts"
fail=[]

def check(label, ok):
    print(("[PASS] " if ok else "[FAIL] ")+label)
    if not ok: fail.append(label)

for p in (TRUTH,SETTLEMENT,INTAKE):
    check(f"source exists: {p.relative_to(ROOT)}",p.is_file())
if fail: raise SystemExit(1)

truth=TRUTH.read_text(encoding="utf-8")
settlement=SETTLEMENT.read_text(encoding="utf-8")
intake=INTAKE.read_text(encoding="utf-8")

# Reasoning/evidence process may observe canonical settlement rows, but may not
# possess or use processor authority.
for token in ("STRIPE_SECRET_KEY","STRIPE_API_KEY","api.stripe.com","npm:stripe","Stripe("):
    check(f"Truth Oracle has no processor authority token: {token}",token not in truth)
check("Truth Oracle explicitly reports no Stripe API access", 'stripe_api_access:false' in truth)
check("Truth Oracle explicitly reports no settlement mutation authority", 'mutation_allowed:false' in truth)
check("Truth Oracle reads canonical settlement rows", 'from("revenue_orders")' in truth and 'from("economic_events")' in truth)

# The payment boundary is the only source in this contract that processes a
# signed Stripe event and writes settlement state.
check("settlement function owns processor credential", "STRIPE_API_KEY" in settlement or "STRIPE_SECRET_KEY" in settlement)
check("settlement function requires webhook signing secret","STRIPE_WEBHOOK_SIGNING_SECRET" in settlement)
check("settlement function cryptographically verifies Stripe event","constructEventAsync" in settlement)
check("settlement function is idempotent","stripe_webhook_events" in settlement and "processed" in settlement)
check("settlement function writes paid order",'from("revenue_orders")' in settlement and 'status:"paid"' in settlement)
check("settlement function creates entitlement",'from("revenue_entitlements")' in settlement)
check("settlement function creates fulfillment request",'from("fulfillment_requests")' in settlement)

# Intake has read-only payment verification capability. It can verify the
# Checkout Session but cannot create/refund/transfer money.
check("intake verifies paid session server-side","stripe.checkout.sessions.retrieve(sessionId)" in intake)
for token in ("paymentIntents.create","checkout.sessions.create","refunds.create","transfers.create"):
    check(f"intake cannot perform money mutation: {token}",token not in intake)

print("\nREVENUE_IDENTITY_BOUNDARY=" + ("FAIL" if fail else "PASS"))
if fail:
    print("Failed: "+", ".join(fail))
    sys.exit(1)
