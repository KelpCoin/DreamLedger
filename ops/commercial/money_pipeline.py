#!/usr/bin/env python3
"""
Phase 0 money pipeline — local / air-gap capable.

Records order → payment evidence → economic event from a *verified*
Stripe-like payload. Does NOT talk to Stripe itself (actuator/webhook does).
Does NOT set verified external revenue without livemode + explicit flag.

Usage:
  python3 ops/commercial/money_pipeline.py init-db
  python3 ops/commercial/money_pipeline.py ingest-fixture fixtures/sample_paid.json
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DB = ROOT / "ops" / "commercial" / "data" / "commercial.sqlite3"


def utc() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def connect() -> sqlite3.Connection:
    DB.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    return conn


def init_db(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS commercial_orders (
          order_id TEXT PRIMARY KEY,
          offer_id TEXT,
          amount_cents INTEGER NOT NULL,
          currency TEXT NOT NULL,
          status TEXT NOT NULL,
          stripe_checkout_session_id TEXT,
          stripe_payment_intent_id TEXT,
          created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS commercial_payments (
          payment_id TEXT PRIMARY KEY,
          order_id TEXT,
          stripe_payment_intent_id TEXT,
          amount_cents INTEGER NOT NULL,
          currency TEXT NOT NULL,
          status TEXT NOT NULL,
          livemode INTEGER NOT NULL,
          event_id TEXT UNIQUE,
          created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS commercial_evidence (
          evidence_id TEXT PRIMARY KEY,
          source TEXT NOT NULL,
          source_event_id TEXT,
          event_type TEXT NOT NULL,
          payload_hash TEXT NOT NULL,
          observed_at TEXT NOT NULL,
          verified_at TEXT,
          verification_method TEXT
        );
        CREATE TABLE IF NOT EXISTS commercial_economic_events (
          economic_event_id TEXT PRIMARY KEY,
          event_type TEXT NOT NULL,
          order_id TEXT,
          payment_id TEXT,
          amount_cents INTEGER NOT NULL,
          currency TEXT NOT NULL,
          evidence_ids TEXT,
          finalized_at TEXT NOT NULL,
          counts_as_verified_external_revenue INTEGER NOT NULL
        );
        """
    )
    conn.commit()


def payload_hash(obj: dict) -> str:
    raw = json.dumps(obj, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def ingest_verified_payment(conn: sqlite3.Connection, payload: dict, *, signature_verified: bool) -> dict:
    """Ingest only after webhook signature verification upstream."""
    if not signature_verified:
        raise ValueError("refusing unverified payload")

    event_id = payload.get("id") or payload.get("event_id")
    if not event_id:
        raise ValueError("event id required")

    existing = conn.execute(
        "SELECT payment_id FROM commercial_payments WHERE event_id = ?", (event_id,)
    ).fetchone()
    if existing:
        return {"ok": True, "idempotent": True, "payment_id": existing["payment_id"]}

    data = payload.get("data", {}).get("object", payload)
    amount = int(data.get("amount_total") or data.get("amount") or 0)
    currency = str(data.get("currency") or "nzd").upper()
    if currency == "NZD" and amount < 100 and "amount_total" not in data:
        # allow cents already
        pass
    livemode = bool(data.get("livemode") or payload.get("livemode"))
    session_id = data.get("id") if data.get("object") == "checkout.session" else data.get("checkout_session")
    pi = data.get("payment_intent")

    order_id = f"ord_{uuid.uuid4().hex[:12]}"
    payment_id = f"pay_{uuid.uuid4().hex[:12]}"
    evidence_id = f"ev_{uuid.uuid4().hex[:12]}"
    econ_id = f"econ_{uuid.uuid4().hex[:12]}"
    now = utc()

    conn.execute(
        "INSERT INTO commercial_orders VALUES (?,?,?,?,?,?,?,?,?)",
        (
            order_id,
            data.get("client_reference_id") or data.get("metadata", {}).get("offer_id"),
            amount,
            currency,
            "payment_succeeded",
            session_id,
            pi,
            now,
        ),
    )
    conn.execute(
        "INSERT INTO commercial_payments VALUES (?,?,?,?,?,?,?,?,?)",
        (payment_id, order_id, pi, amount, currency, "succeeded", 1 if livemode else 0, event_id, now),
    )
    conn.execute(
        "INSERT INTO commercial_evidence VALUES (?,?,?,?,?,?,?,?)",
        (
            evidence_id,
            "stripe",
            event_id,
            payload.get("type") or "payment",
            payload_hash(payload),
            now,
            now,
            "stripe_signature_verified",
        ),
    )
    # External revenue only if livemode AND caller marks external (default false for safety)
    external = bool(payload.get("dreamledger_external_buyer")) and livemode
    conn.execute(
        "INSERT INTO commercial_economic_events VALUES (?,?,?,?,?,?,?,?,?)",
        (
            econ_id,
            "payment_succeeded",
            order_id,
            payment_id,
            amount,
            currency,
            json.dumps([evidence_id]),
            now,
            1 if external else 0,
        ),
    )
    conn.commit()
    return {
        "ok": True,
        "order_id": order_id,
        "payment_id": payment_id,
        "economic_event_id": econ_id,
        "counts_as_verified_external_revenue": external,
        "livemode": livemode,
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("init-db")
    p_ing = sub.add_parser("ingest-fixture")
    p_ing.add_argument("path")
    p_ing.add_argument("--external", action="store_true")
    args = ap.parse_args()

    conn = connect()
    if args.cmd == "init-db":
        init_db(conn)
        print(json.dumps({"ok": True, "db": str(DB)}))
        return

    if args.cmd == "ingest-fixture":
        init_db(conn)
        payload = json.loads(Path(args.path).read_text(encoding="utf-8"))
        if args.external:
            payload["dreamledger_external_buyer"] = True
        print(json.dumps(ingest_verified_payment(conn, payload, signature_verified=True), indent=2))


if __name__ == "__main__":
    main()
