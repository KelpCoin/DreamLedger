"""Settlement consumer.

Stripe webhook events are durable input. This process drains that queue and
is the only component allowed to perform the server-side paid/fulfillment
order transition. It never creates charges and never trusts caller claims.
"""
from __future__ import annotations

import os
import time
import traceback
from typing import Any

import httpx

SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
WORKER_ID = os.environ.get("SETTLEMENT_WORKER_ID", "settlement-1")
POLL_INTERVAL = float(os.environ.get("SETTLEMENT_POLL_SECONDS", "2"))
MAX_BATCH = int(os.environ.get("SETTLEMENT_MAX_BATCH", "10"))

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}


def _rpc(name: str, payload: dict[str, Any]) -> Any:
    r = httpx.post(f"{SUPABASE_URL}/rest/v1/rpc/{name}", headers=HEADERS, json=payload, timeout=30.0)
    r.raise_for_status()
    return r.json() if r.text else None


def _select(table: str, params: dict[str, str]) -> list[dict[str, Any]]:
    r = httpx.get(f"{SUPABASE_URL}/rest/v1/{table}", headers=HEADERS, params=params, timeout=30.0)
    r.raise_for_status()
    return r.json()


def drain_once() -> int:
    claim = _rpc("settlement_claim_batch", {
        "p_worker_id": WORKER_ID,
        "p_max": MAX_BATCH,
        "p_lease_secs": 120,
    })
    if not claim:
        return 0

    processed = 0
    for row in claim:
        event_id = row["provider_event_id"]
        try:
            _process(row["payload"])
            _rpc("settlement_finish", {"p_event_id": event_id, "p_status": "done", "p_error": None})
            processed += 1
        except Exception as exc:
            _rpc("settlement_finish", {
                "p_event_id": event_id,
                "p_status": "failed",
                "p_error": f"{type(exc).__name__}: {exc}",
            })
            print(f"[{WORKER_ID}] settlement event {event_id} failed: {exc}")
            traceback.print_exc()
    return processed


def _process(event: dict[str, Any]) -> None:
    event_type = event.get("type")
    if event_type in ("checkout.session.completed", "checkout.session.async_payment_succeeded"):
        _handle_checkout_completed(event)
    elif event_type == "payment_intent.succeeded":
        _handle_payment_intent_succeeded(event)


def _handle_checkout_completed(event: dict[str, Any]) -> None:
    session = event["data"]["object"]
    if session.get("payment_status") != "paid":
        return

    session_id = session["id"]
    rows = _select("marketplace_orders", {
        "checkout_session_id": f"eq.{session_id}",
        "select": "id,order_state,state_version,checkout_session_id",
        "limit": "1",
    })
    if not rows:
        raise RuntimeError(f"no marketplace order for Stripe session {session_id}")

    order = rows[0]
    if order["order_state"] in ("paid", "fulfillment", "complete"):
        return
    if order["order_state"] != "payment_pending":
        raise RuntimeError(f"order {order['id']} in unexpected state {order['order_state']}")

    _transition_with_retry(
        order_id=order["id"],
        version=order["state_version"],
        to_state="paid",
        reason=f"stripe {event['type']} {session_id}",
    )


def _handle_payment_intent_succeeded(event: dict[str, Any]) -> None:
    intent_id = event["data"]["object"]["id"]
    rows = _select("marketplace_orders", {
        "stripe_payment_intent_id": f"eq.{intent_id}",
        "select": "id,order_state,state_version",
        "limit": "1",
    })
    if not rows or rows[0]["order_state"] in ("paid", "fulfillment", "complete"):
        return
    # The checkout session is the authoritative order correlation. This event
    # is retained as evidence but never independently advances the order.


def _transition_with_retry(order_id: str, version: int, to_state: str, reason: str, max_attempts: int = 3) -> None:
    expected = version
    for attempt in range(max_attempts):
        try:
            _rpc("transition_marketplace_order", {
                "p_order_id": order_id,
                "p_expected_version": expected,
                "p_to_state": to_state,
                "p_actor_user_id": None,
                "p_actor_org_id": None,
                "p_idempotency_key": f"settlement:{order_id}:{to_state}",
                "p_reason": reason,
            })
            return
        except httpx.HTTPStatusError as exc:
            body = exc.response.text
            if "P0002" not in body and "stale order version" not in body:
                raise
            time.sleep(0.2 * (attempt + 1))
            rows = _select("marketplace_orders", {
                "id": f"eq.{order_id}",
                "select": "id,order_state,state_version",
                "limit": "1",
            })
            if not rows:
                raise RuntimeError(f"order disappeared during transition: {order_id}")
            if rows[0]["order_state"] in ("paid", "fulfillment", "complete"):
                return
            expected = rows[0]["state_version"]
    raise RuntimeError(f"transition_marketplace_order failed after {max_attempts} attempts")


def main() -> None:
    print(f"[{WORKER_ID}] settlement consumer starting")
    while True:
        try:
            processed = drain_once()
            if processed == 0:
                time.sleep(POLL_INTERVAL)
        except KeyboardInterrupt:
            return
        except Exception as exc:
            print(f"[{WORKER_ID}] drain error: {exc}")
            traceback.print_exc()
            time.sleep(POLL_INTERVAL * 5)


if __name__ == "__main__":
    main()
