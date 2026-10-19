"""Private, arithmetic-only care-funding gap planner for BECK.

Do not pass diagnosis, treatment notes, provider names, or identifying information.
This module does not store inputs, contact anyone, promise funding, or treat projected
sales, unpaid checkouts, gross receipts, or unfulfilled orders as available money.
"""
from __future__ import annotations

from math import ceil, isfinite
from typing import Any


def _amount(name: str, value: float | int) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise TypeError(f"{name} must be a numeric NZD amount")
    amount = float(value)
    if not isfinite(amount) or amount < 0:
        raise ValueError(f"{name} must be finite and non-negative")
    return round(amount, 2)


def build_care_funding_gap_plan(
    *,
    itemised_care_quote_nzd: float,
    confirmed_support_nzd: float = 0,
    cash_already_set_aside_nzd: float = 0,
    settled_and_available_care_fund_nzd: float = 0,
    verified_net_contribution_per_fulfilled_sale_nzd: float | None = None,
) -> dict[str, Any]:
    """Calculate a funding gap without persisting sensitive inputs.

    confirmed_support_nzd means support already confirmed in writing, not an
    application or hoped-for grant. The settled fund excludes unpaid, pending,
    disputed, refunded, or unmatched payments. Per-sale contribution must be a
    grounded net amount after fees/refunds and fulfilment costs. Any sales count
    is a scenario calculation, never a forecast or claim that a buyer exists.
    """
    quote = _amount("itemised_care_quote_nzd", itemised_care_quote_nzd)
    support = _amount("confirmed_support_nzd", confirmed_support_nzd)
    cash = _amount("cash_already_set_aside_nzd", cash_already_set_aside_nzd)
    settled = _amount("settled_and_available_care_fund_nzd", settled_and_available_care_fund_nzd)

    covered = round(support + cash + settled, 2)
    gap = round(max(0.0, quote - covered), 2)
    result: dict[str, Any] = {
        "currency": "NZD",
        "itemised_care_quote_nzd": quote,
        "confirmed_support_nzd": support,
        "cash_already_set_aside_nzd": cash,
        "settled_and_available_care_fund_nzd": settled,
        "known_funds_total_nzd": covered,
        "remaining_gap_nzd": gap,
        "funding_gap_status": "COVERED_ON_INPUTS" if gap == 0 else "GAP_REMAINS",
        "fulfilled_sales_scenario": None,
        "evidence_required": [
            "An itemised provider quote or invoice; do not infer the cost from a diagnosis.",
            "Written funding/support decisions; pending applications count as zero confirmed support.",
            "Payment processor evidence that funds settled and are available, net of refunds and fees.",
            "Fulfilment evidence and direct costs before counting a sale's net contribution.",
        ],
        "privacy": "Inputs are used only for this calculation; this function does not persist or log them.",
        "limitations": [
            "This is arithmetic, not medical advice, funding eligibility, or a guarantee of treatment.",
            "A calculated sales count is a scenario only and does not establish demand, a buyer, or future income.",
        ],
    }
    if verified_net_contribution_per_fulfilled_sale_nzd is not None:
        contribution = _amount(
            "verified_net_contribution_per_fulfilled_sale_nzd",
            verified_net_contribution_per_fulfilled_sale_nzd,
        )
        result["fulfilled_sales_scenario"] = {
            "verified_net_contribution_per_sale_nzd": contribution,
            "sales_needed": 0 if gap == 0 else (ceil(gap / contribution) if contribution > 0 else None),
            "basis": "Scenario only; count only fulfilled sales with independently verified settled net contribution.",
        }
    return result
