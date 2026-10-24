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
        CREATE TABLE IF NOT EXISTS stripe_event_inbox (
          event_id TEXT PRIMARY KEY,
          payload_hash TEXT NOT NULL,
          state TEXT NOT NULL CHECK (state IN ('CLAIMED', 'PAYMENT_RECORDED')),
          created_at TEXT NOT NULL
        );
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
    """Accept pre-verified signed Stripe events, atomically claim event ID and stage records.

    External delivery must happen after commit using a durable fulfillment outbox.
    This function never declares external revenue verified.
    """
    if not signature_verified:
        raise ValueError("refusing unverified payload")
    event_id = str(payload.get("id") or payload.get("event_id") or "")
    if not event_id:
        raise ValueError("event id required")
    data = payload.get("data", {}).get("object", {})
    if (payload.get("type") != "checkout.session.completed"
            or data.get("object") != "checkout.session"
            or data.get("payment_status") != "paid"):
        raise ValueError("only paid checkout.session.completed events are accepted")
    amount = int(data.get("amount_total") or 0)
    currency = str(data.get("currency") or "").upper()
    if amount <= 0 or not currency or len(currency) != 3:
        raise ValueError("valid paid amount and currency required")
    livemode = bool(payload.get("livemode")) and bool(data.get("livemode"))
    session_id = str(data.get("id") or "")
    if not session_id:
        raise ValueError("session id required")
    pi = data.get("payment_intent")
    order_id = f"ord_{uuid.uuid4().hex[:12]}"
    payment_id = f"pay_{uuid.uuid4().hex[:12]}"
    evidence_id = f"ev_{uuid.uuid4().hex[:12]}"
    econ_id = f"econ_{uuid.uuid4().hex[:12]}"
    now = utc()
    # BEGIN IMMEDIATE serializes concurrent writers (SQLite). The first INSERT,
    # not a SELECT, owns the event claim. Real Postgres uses INSERT ON CONFLICT.
    conn.execute("BEGIN IMMEDIATE")
    try:
        conn.execute(
            "INSERT INTO stripe_event_inbox (event_id,payload_hash,state,created_at) VALUES (?,?,?,?)",
            (event_id,payload_hash(payload),"CLAIMED",now),
        )
    except sqlite3.IntegrityError:
        conn.rollback()
        existing = conn.execute(
            "SELECT payment_id FROM commercial_payments WHERE event_id = ?", (event_id,)
        ).fetchone()
        if existing:
            return {"ok": True, "idempotent": True, "payment_id": existing["payment_id"]}
        # Never remove an uncertain claim and re-run side effects.
        raise ValueError("event is already claimed but payment needs reconciliation")
    try:
        conn.execute(
            "INSERT INTO commercial_orders VALUES (?,?,?,?,?,?,?,?)",
            (order_id, data.get("client_reference_id") or data.get("metadata", {}).get("offer_id"),
             amount,currency,"payment_succeeded",session_id,pi,now),
        )
        conn.execute(
            "INSERT INTO commercial_payments VALUES (?,?,?,?,?,?,?,?,?)",
            (payment_id,order_id,pi,amount,currency,"succeeded",int(livemode),event_id,now),
        )
        conn.execute(
            "INSERT INTO commercial_evidence VALUES (?,?,?,?,?,?,?,?)",
            (evidence_id,"stripe",event_id,payload.get("type"),payload_hash(payload),
             now,now,"stripe_signature_verified_upstream"),
        )
        conn.execute(
            "INSERT INTO commercial_economic_events VALUES (?,?,?,?,?,?,?,?,?)",
            (econ_id,"payment_succeeded",order_id,payment_id,amount,currency,
             json.dumps([evidence_id]),now,0),
        )
        conn.execute(
            "UPDATE stripe_event_inbox SET state='PAYMENT_RECORDED' WHERE event_id=?", (event_id,)
        )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    return {
        "ok": True,
        "order_id": order_id,
        "payment_id": payment_id,
        "economic_event_id": econ_id,
        "counts_as_verified_external_revenue": False,
        "livemode": livemode,
        "economic_state": "PAYMENT_ONLY_AWAITING_FULFILLMENT_PROOF" if livemode else "TEST_OR_UNVERIFIED",
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("init-db")
    p_ing = sub.add_parser("ingest-fixture")
    p_ing.add_argument("path")
    p_ing.add_argument("--external", action="store_true")
    args = ap.parse_args()

    if args.cmd == "ingest-fixture" and args.external:
        ap.error("--external cannot certify revenue; independently verified delivery evidence is required")

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
