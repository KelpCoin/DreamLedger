#!/usr/bin/env python3
"""
Performance Wall — air-gap / local cubby mint + claim (no Stripe calls).

Simulates: key → cubby → claim → seal after TTL.
Production wires the same shape from a verified webhook handler.

  python BEC-PRIME/fulfillment/performance_wall.py mint --offer OFFER-DEMO --payload-url https://example.com/file.pdf
  python BEC-PRIME/fulfillment/performance_wall.py claim --key <raw>
  python BEC-PRIME/fulfillment/performance_wall.py seal-expired
  python BEC-PRIME/fulfillment/performance_wall.py list
"""
from __future__ import annotations

import argparse
import hashlib
import json
import secrets
import sqlite3
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

DB = Path(__file__).resolve().parent / "data" / "performance_wall.sqlite"
TTL_HOURS_DEFAULT = 24


def connect() -> sqlite3.Connection:
    DB.parent.mkdir(parents=True, exist_ok=True)
    c = sqlite3.connect(str(DB))
    c.row_factory = sqlite3.Row
    c.executescript(
        """
        CREATE TABLE IF NOT EXISTS cubbies (
          cubby_id TEXT PRIMARY KEY,
          checkout_session_id TEXT NOT NULL UNIQUE,
          offer_id TEXT NOT NULL,
          silo TEXT NOT NULL DEFAULT 'digital-products',
          key_hash TEXT NOT NULL,
          status TEXT NOT NULL,
          payload_kind TEXT NOT NULL,
          payload_value TEXT NOT NULL,
          opened_at TEXT NOT NULL,
          expires_at TEXT NOT NULL,
          claimed_at TEXT,
          livemode INTEGER NOT NULL DEFAULT 0
        );
        """
    )
    c.commit()
    return c


def hash_key(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def mint(
    checkout_session_id: str,
    offer_id: str,
    payload_kind: str,
    payload_value: str,
    ttl_hours: float = TTL_HOURS_DEFAULT,
    silo: str = "digital-products",
    livemode: bool = False,
) -> dict:
    conn = connect()
    existing = conn.execute(
        "SELECT cubby_id FROM cubbies WHERE checkout_session_id=?",
        (checkout_session_id,),
    ).fetchone()
    if existing:
        return {"idempotent": True, "cubby_id": existing["cubby_id"], "raw_key": None}

    raw_key = secrets.token_urlsafe(24)
    cubby_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    exp = now + timedelta(hours=ttl_hours)
    conn.execute(
        """
        INSERT INTO cubbies(
          cubby_id, checkout_session_id, offer_id, silo, key_hash, status,
          payload_kind, payload_value, opened_at, expires_at, livemode
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?)
        """,
        (
            cubby_id,
            checkout_session_id,
            offer_id,
            silo,
            hash_key(raw_key),
            "OPEN",
            payload_kind,
            payload_value,
            now.isoformat(),
            exp.isoformat(),
            1 if livemode else 0,
        ),
    )
    conn.commit()
    return {
        "idempotent": False,
        "cubby_id": cubby_id,
        "raw_key": raw_key,
        "claim_path": f"/wall/claim?key={raw_key}",
        "expires_at": exp.isoformat(),
        "policy": "Show raw_key once. Revenue still requires Settlement Sync + fossil when livemode.",
    }


def claim(raw_key: str) -> dict:
    conn = connect()
    h = hash_key(raw_key)
    row = conn.execute("SELECT * FROM cubbies WHERE key_hash=?", (h,)).fetchone()
    if not row:
        return {"ok": False, "error": "invalid_key"}
    now = datetime.now(timezone.utc)
    exp = datetime.fromisoformat(row["expires_at"])
    if row["status"] == "SEALED" or now > exp:
        conn.execute(
            "UPDATE cubbies SET status='SEALED' WHERE cubby_id=?",
            (row["cubby_id"],),
        )
        conn.commit()
        return {"ok": False, "error": "sealed", "cubby_id": row["cubby_id"]}
    if row["status"] == "VOID":
        return {"ok": False, "error": "void"}
    conn.execute(
        "UPDATE cubbies SET status='CLAIMED', claimed_at=? WHERE cubby_id=?",
        (now.isoformat(), row["cubby_id"]),
    )
    conn.commit()
    return {
        "ok": True,
        "cubby_id": row["cubby_id"],
        "offer_id": row["offer_id"],
        "payload": {"kind": row["payload_kind"], "value": row["payload_value"]},
        "expires_at": row["expires_at"],
    }


def seal_expired() -> dict:
    conn = connect()
    now = datetime.now(timezone.utc).isoformat()
    cur = conn.execute(
        "UPDATE cubbies SET status='SEALED' WHERE status IN ('OPEN','CLAIMED') AND expires_at < ?",
        (now,),
    )
    conn.commit()
    return {"sealed": cur.rowcount}


def list_cubbies() -> list:
    conn = connect()
    rows = conn.execute(
        "SELECT cubby_id, checkout_session_id, offer_id, status, opened_at, expires_at, livemode FROM cubbies ORDER BY opened_at DESC"
    ).fetchall()
    return [dict(r) for r in rows]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("command", choices=["mint", "claim", "seal-expired", "list"])
    ap.add_argument("--offer", default="OFFER-DEMO")
    ap.add_argument("--session", default="")
    ap.add_argument("--payload-url", default="")
    ap.add_argument("--payload-text", default="")
    ap.add_argument("--key", default="")
    ap.add_argument("--ttl", type=float, default=TTL_HOURS_DEFAULT)
    args = ap.parse_args()

    if args.command == "mint":
        session = args.session or f"cs_test_{uuid.uuid4().hex[:16]}"
        if args.payload_url:
            kind, val = "url", args.payload_url
        else:
            kind, val = "inline_text", args.payload_text or "Deliverable placeholder"
        print(json.dumps(mint(session, args.offer, kind, val, ttl_hours=args.ttl), indent=2))
        return 0
    if args.command == "claim":
        if not args.key:
            raise SystemExit("--key required")
        print(json.dumps(claim(args.key), indent=2))
        return 0
    if args.command == "seal-expired":
        print(json.dumps(seal_expired(), indent=2))
        return 0
    if args.command == "list":
        print(json.dumps(list_cubbies(), indent=2))
        return 0
    return 1


if __name__ == "__main__":
    sys.exit(main())
