"""Fail-closed economic event gate. No network, credentials, or payment mutation."""
from decimal import Decimal, InvalidOperation

REQUIRED = ("payment_id", "external_buyer_verified", "settled", "sku", "delivery_sha256", "direct_cost_nzd", "amount_nzd", "operator_minutes")

def evaluate(event):
    missing = [k for k in REQUIRED if k not in event]
    if missing:
        return {"verdict": "HOLD", "reasons": ["missing:" + ",".join(missing)]}
    reasons = []
    if event["external_buyer_verified"] is not True: reasons.append("buyer_unverified")
    if event["settled"] is not True: reasons.append("payment_unsettled")
    if not isinstance(event["payment_id"], str) or not event["payment_id"].startswith("pi_"): reasons.append("payment_reference_invalid")
    if not isinstance(event["sku"], str) or not event["sku"].strip(): reasons.append("sku_missing")
    h = event["delivery_sha256"]
    if not isinstance(h, str) or len(h) != 64 or any(c not in "0123456789abcdef" for c in h): reasons.append("delivery_proof_invalid")
    try:
        amount = Decimal(str(event["amount_nzd"]))
        cost = Decimal(str(event["direct_cost_nzd"]))
        minutes = Decimal(str(event["operator_minutes"]))
        if not all(x.is_finite() for x in (amount,cost,minutes)) or amount <= 0 or cost < 0 or minutes < 0:
            reasons.append("invalid_economics")
    except (InvalidOperation, ValueError, TypeError):
        reasons.append("invalid_economics")
    if reasons: return {"verdict": "HOLD", "reasons": reasons}
    return {"verdict": "PROVISIONAL", "contribution_nzd": str(amount-cost), "reasons": ["requires_provider_reconciliation_and_independent_delivery_verification"]}
