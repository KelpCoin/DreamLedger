#!/usr/bin/env python3
"""
stripe_supabase_reconcile.py

Read-only Stripe/Supabase reconciliation for DreamLedger revenue_catalog.

For each offer, compare Stripe's authoritative product/price state with
Supabase's catalog state and classify each checked field as VERIFIED,
CONTRADICTED, UNMATCHED, or UNKNOWN.

No secrets are hardcoded. No Stripe writes occur. Supabase writes occur only
with the explicit --write-evidence flag, and that write is an evidence note,
never a revenue/payment record.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

import requests

try:
    import stripe
except ImportError:
    print("Missing dependency: pip install stripe requests", file=sys.stderr)
    raise SystemExit(1)


STRIPE_SECRET_KEY = os.environ.get("STRIPE_SECRET_KEY")
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

VERDICTS = ("VERIFIED", "CONTRADICTED", "UNMATCHED", "UNKNOWN")


@dataclass
class FieldCheck:
    name: str
    supabase_value: Any
    stripe_value: Any
    verdict: str
    note: str = ""


@dataclass
class OfferReport:
    sku_id: str
    name: str
    checks: list[FieldCheck] = field(default_factory=list)
    stripe_reachable: bool = False
    error: str | None = None

    def overall(self) -> str:
        if self.error:
            return "UNKNOWN"
        verdicts = {c.verdict for c in self.checks}
        if "CONTRADICTED" in verdicts:
            return "CONTRADICTED"
        if "UNKNOWN" in verdicts:
            return "UNKNOWN"
        if verdicts == {"VERIFIED"}:
            return "VERIFIED"
        return "UNMATCHED"


class QueryOutcome:
    SUCCESS_WITH_RECORDS = "QUERY_SUCCESS_WITH_RECORDS"
    SUCCESS_ZERO_RECORDS = "QUERY_SUCCESS_WITH_ZERO_RECORDS"
    FAILURE = "QUERY_FAILURE"


def fail_if_missing_env() -> None:
    required = {
        "STRIPE_SECRET_KEY": STRIPE_SECRET_KEY,
        "SUPABASE_URL": SUPABASE_URL,
        "SUPABASE_SERVICE_ROLE_KEY": SUPABASE_SERVICE_ROLE_KEY,
    }
    missing = [name for name, value in required.items() if not value]
    if missing:
        print("Cannot run -- missing required environment variables:", file=sys.stderr)
        for name in missing:
            print(f"  - {name}", file=sys.stderr)
        raise SystemExit(1)


def supabase_get(table: str, params: dict[str, str]) -> list[dict]:
    url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/{table}"
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
    }
    response = requests.get(url, headers=headers, params=params, timeout=15)
    response.raise_for_status()
    data = response.json()
    if not isinstance(data, list):
        raise ValueError(f"Supabase {table} response was not a JSON array")
    return data


def fetch_catalog_rows(sku_filter: str | None) -> list[dict]:
    params = {
        "select": "sku_id,name,price_nzd,active,stripe_product_id,stripe_price_id,stripe_payment_link"
    }
    if sku_filter:
        params["sku_id"] = f"eq.{sku_filter}"
    return supabase_get("revenue_catalog", params)


def fetch_matching_webhook_events(
    stripe_price_id: str | None,
) -> tuple[str, list[dict], str | None]:
    """
    The current production stripe_webhook_events table is empty, so a successful
    zero-row query is UNMATCHED evidence, not a query failure.

    When rows exist, this uses a documented PostgREST JSON containment filter.
    A filter-shape/schema failure remains UNKNOWN rather than being treated as
    zero matching events.
    """
    if not stripe_price_id:
        return QueryOutcome.FAILURE, [], "No stripe_price_id supplied."

    try:
        population = supabase_get("stripe_webhook_events", {"select": "event_id"})
    except (requests.RequestException, ValueError) as exc:
        return QueryOutcome.FAILURE, [], f"Webhook table query failed: {exc}"

    if not population:
        return QueryOutcome.SUCCESS_ZERO_RECORDS, [], None

    try:
        params = {
            "select": "event_id,event_type,processed,created_at,payload",
            "payload": f"cs.{{"price":"{stripe_price_id}"}}",
        }
        events = supabase_get("stripe_webhook_events", params)
    except (requests.RequestException, ValueError) as exc:
        return QueryOutcome.FAILURE, [], (
            "Could not reliably associate webhook payloads with the Stripe "
            f"price reference: {exc}"
        )

    return (
        QueryOutcome.SUCCESS_WITH_RECORDS if events else QueryOutcome.SUCCESS_ZERO_RECORDS,
        events,
        None,
    )


def fetch_stripe_state(price_id: str | None, product_id: str | None) -> dict[str, Any]:
    stripe.api_key = STRIPE_SECRET_KEY
    out: dict[str, Any] = {"price": None, "product": None, "error": None}

    stripe_error_cls = getattr(stripe, "StripeError", None) or getattr(
        getattr(stripe, "error", None), "StripeError", None
    )
    if stripe_error_cls is None:
        out["error"] = "Installed Stripe SDK exposes no recognizable StripeError class."
        return out

    try:
        if price_id:
            out["price"] = stripe.Price.retrieve(price_id)
        if product_id:
            out["product"] = stripe.Product.retrieve(product_id)
    except stripe_error_cls as exc:
        out["error"] = json.dumps(
            {
                "message": str(exc),
                "http_status": getattr(exc, "http_status", None),
                "code": getattr(exc, "code", None),
                "request_id": getattr(exc, "request_id", None),
            }
        )
    except Exception as exc:
        out["error"] = f"Unexpected Stripe SDK failure: {type(exc).__name__}: {exc}"

    return out


def reconcile_offer(row: dict) -> OfferReport:
    report = OfferReport(
        sku_id=row.get("sku_id", "UNKNOWN_SKU"),
        name=row.get("name", ""),
    )

    price_id = row.get("stripe_price_id")
    product_id = row.get("stripe_product_id")

    if not price_id and not product_id:
        report.checks.append(
            FieldCheck(
                "stripe_reference_present",
                None,
                None,
                "UNMATCHED",
                "No Stripe price/product ID is recorded for this SKU.",
            )
        )
        return report

    stripe_state = fetch_stripe_state(price_id, product_id)
    if stripe_state["error"]:
        report.error = stripe_state["error"]
        report.checks.append(
            FieldCheck(
                "stripe_reachable",
                price_id or product_id,
                None,
                "UNKNOWN",
                f"Stripe API error: {stripe_state['error']}",
            )
        )
        return report

    report.stripe_reachable = True
    stripe_price = stripe_state["price"]
    stripe_product = stripe_state["product"]

    if stripe_price is not None:
        s_active = bool(stripe_price.get("active"))
        db_active = bool(row.get("active"))
        report.checks.append(
            FieldCheck(
                "active_status",
                db_active,
                s_active,
                "VERIFIED" if s_active == db_active else "CONTRADICTED",
            )
        )

        s_amount_cents = stripe_price.get("unit_amount")
        db_amount_cents = (
            int(round(float(row["price_nzd"]) * 100))
            if row.get("price_nzd") is not None
            else None
        )
        if s_amount_cents is None or db_amount_cents is None:
            amount_verdict = "UNKNOWN"
        else:
            amount_verdict = (
                "VERIFIED" if s_amount_cents == db_amount_cents else "CONTRADICTED"
            )
        report.checks.append(
            FieldCheck("price_amount_cents", db_amount_cents, s_amount_cents, amount_verdict)
        )

        s_currency = (stripe_price.get("currency") or "").upper() or None
        report.checks.append(
            FieldCheck(
                "currency",
                None,
                s_currency,
                "UNKNOWN",
                "revenue_catalog has no currency column; Stripe alone is authoritative here.",
            )
        )
    else:
        report.checks.append(
            FieldCheck(
                "price_object",
                price_id,
                None,
                "UNKNOWN",
                "No stripe_price_id was available to retrieve a Price object.",
            )
        )

    if stripe_product is not None:
        product_active = bool(stripe_product.get("active"))
        report.checks.append(
            FieldCheck(
                "product_active",
                True,
                product_active,
                "VERIFIED" if product_active else "CONTRADICTED",
                "Catalog presence is treated as the expected-live product state.",
            )
        )

    outcome, events, err_detail = fetch_matching_webhook_events(price_id)
    if outcome == QueryOutcome.FAILURE:
        report.checks.append(
            FieldCheck(
                "settled_payment_evidence",
                None,
                "query failed",
                "UNKNOWN",
                err_detail or "Webhook evidence query failed.",
            )
        )
    elif outcome == QueryOutcome.SUCCESS_ZERO_RECORDS:
        report.checks.append(
            FieldCheck(
                "settled_payment_evidence",
                None,
                "0 matching events",
                "UNMATCHED",
                "Webhook query succeeded and found no matching events. This is not revenue evidence.",
            )
        )
    else:
        settled_types = {
            "checkout.session.completed",
            "payment_intent.succeeded",
            "charge.succeeded",
        }
        settled_events = [
            event for event in events
            if event.get("event_type") in settled_types
        ]
        if settled_events:
            verdict = "VERIFIED"
            note = (
                "A Stripe-settlement-adjacent event was found. This field alone "
                "does not establish attributed revenue or fulfillment."
            )
            display = f"{len(settled_events)} settlement event(s)"
        else:
            verdict = "UNMATCHED"
            note = (
                "Matching webhook records exist, but none has a recognized "
                "settlement event_type. No revenue conclusion is made."
            )
            display = f"{len(events)} matching webhook event(s), 0 recognized settlement events"
        report.checks.append(
            FieldCheck(
                "settled_payment_evidence",
                None,
                display,
                verdict,
                note,
            )
        )

    return report


def write_evidence(reports: list[OfferReport]) -> None:
    url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/control_bridge_notes"
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }
    body = {
        "from_agent": "stripe_supabase_reconcile_script",
        "to_agent": "human",
        "note_type": "EVIDENCE",
        "subject": f"Stripe/Supabase reconciliation run {datetime.now(timezone.utc).isoformat()}",
        "body": json.dumps(
            {report.sku_id: report.overall() for report in reports},
            indent=2,
        ),
        "requires_response": False,
        "lane": "evidence",
        "source_system": "stripe_supabase_reconcile.py",
    }
    response = requests.post(url, headers=headers, json=body, timeout=15)
    response.raise_for_status()
    print("Evidence record written to control_bridge_notes.")


def print_report(report: OfferReport) -> None:
    print(f"\n=== {report.sku_id} -- {report.name} ===")
    if report.error:
        print(f"  UNKNOWN (Stripe error): {report.error}")
        return
    for check in report.checks:
        print(
            f"  [{check.verdict:12}] {check.name}: "
            f"supabase={check.supabase_value!r} stripe={check.stripe_value!r}"
        )
        if check.note:
            print(f"               note: {check.note}")
    print(f"  --> OVERALL: {report.overall()}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sku", help="Check one SKU instead of the full catalog")
    parser.add_argument(
        "--write-evidence",
        action="store_true",
        help="Persist this reconciliation's verdict summary as an evidence note.",
    )
    args = parser.parse_args()

    fail_if_missing_env()
    rows = fetch_catalog_rows(args.sku)
    if not rows:
        print("No matching rows found in revenue_catalog.", file=sys.stderr)
        raise SystemExit(1)

    reports = [reconcile_offer(row) for row in rows]
    for report in reports:
        print_report(report)

    print("\n=== SUMMARY ===")
    for report in reports:
        print(f"  {report.sku_id:20} {report.overall()}")

    if args.write_evidence:
        write_evidence(reports)


if __name__ == "__main__":
    main()
