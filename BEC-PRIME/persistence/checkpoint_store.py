#!/usr/bin/env python3
"""
Air-gap checkpoint store (LangGraph-compatible mental model).

- thread_id: stable job key
- checkpoints: ordered snapshots of stage state
- SQLite file: BEC-PRIME/persistence/data/checkpoints.sqlite

No network. No Stripe. No revenue claims.

  python BEC-PRIME/persistence/checkpoint_store.py init
  python BEC-PRIME/persistence/checkpoint_store.py put --thread THREAD-FIRST-SALE --stage SHARE --payload '{"done":true}'
  python BEC-PRIME/persistence/checkpoint_store.py get --thread THREAD-FIRST-SALE
  python BEC-PRIME/persistence/checkpoint_store.py history --thread THREAD-FIRST-SALE
"""
from __future__ import annotations

import argparse
import json
import sqlite3
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DB = Path(__file__).resolve().parent / "data" / "checkpoints.sqlite"


def connect(db: Path) -> sqlite3.Connection:
    db.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db))
    conn.row_factory = sqlite3.Row
    return conn


def setup(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS threads (
          thread_id TEXT PRIMARY KEY,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          meta_json TEXT NOT NULL DEFAULT '{}'
        );
        CREATE TABLE IF NOT EXISTS checkpoints (
          checkpoint_id TEXT PRIMARY KEY,
          thread_id TEXT NOT NULL,
          seq INTEGER NOT NULL,
          stage TEXT NOT NULL,
          created_at TEXT NOT NULL,
          state_json TEXT NOT NULL,
          UNIQUE(thread_id, seq),
          FOREIGN KEY(thread_id) REFERENCES threads(thread_id)
        );
        CREATE INDEX IF NOT EXISTS idx_cp_thread ON checkpoints(thread_id, seq);
        """
    )
    conn.commit()


def ensure_thread(conn: sqlite3.Connection, thread_id: str, meta: dict | None = None) -> None:
    now = datetime.now(timezone.utc).isoformat()
    row = conn.execute("SELECT thread_id FROM threads WHERE thread_id=?", (thread_id,)).fetchone()
    if row:
        conn.execute("UPDATE threads SET updated_at=? WHERE thread_id=?", (now, thread_id))
    else:
        conn.execute(
            "INSERT INTO threads(thread_id, created_at, updated_at, meta_json) VALUES (?,?,?,?)",
            (thread_id, now, now, json.dumps(meta or {})),
        )
    conn.commit()


def put_checkpoint(
    conn: sqlite3.Connection,
    thread_id: str,
    stage: str,
    state: dict,
) -> dict:
    ensure_thread(conn, thread_id)
    last = conn.execute(
        "SELECT COALESCE(MAX(seq), 0) AS m FROM checkpoints WHERE thread_id=?",
        (thread_id,),
    ).fetchone()["m"]
    seq = int(last) + 1
    cp_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    payload = {
        "v": 1,
        "stage": stage,
        "state": state,
        "policy": "Checkpoint is operational memory only. Never declares verified revenue.",
    }
    conn.execute(
        "INSERT INTO checkpoints(checkpoint_id, thread_id, seq, stage, created_at, state_json) VALUES (?,?,?,?,?,?)",
        (cp_id, thread_id, seq, stage, now, json.dumps(payload)),
    )
    conn.execute("UPDATE threads SET updated_at=? WHERE thread_id=?", (now, thread_id))
    conn.commit()
    return {"checkpoint_id": cp_id, "thread_id": thread_id, "seq": seq, "stage": stage, "created_at": now}


def get_latest(conn: sqlite3.Connection, thread_id: str) -> dict | None:
    row = conn.execute(
        "SELECT * FROM checkpoints WHERE thread_id=? ORDER BY seq DESC LIMIT 1",
        (thread_id,),
    ).fetchone()
    if not row:
        return None
    return dict(row) | {"state": json.loads(row["state_json"])}


def history(conn: sqlite3.Connection, thread_id: str, limit: int = 50) -> list:
    rows = conn.execute(
        "SELECT checkpoint_id, seq, stage, created_at, state_json FROM checkpoints WHERE thread_id=? ORDER BY seq DESC LIMIT ?",
        (thread_id, limit),
    ).fetchall()
    out = []
    for r in rows:
        out.append(
            {
                "checkpoint_id": r["checkpoint_id"],
                "seq": r["seq"],
                "stage": r["stage"],
                "created_at": r["created_at"],
                "state": json.loads(r["state_json"]),
            }
        )
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("command", choices=["init", "put", "get", "history"])
    ap.add_argument("--db", default=str(DEFAULT_DB))
    ap.add_argument("--thread", default="THREAD-FIRST-SALE")
    ap.add_argument("--stage", default="UNKNOWN")
    ap.add_argument("--payload", default="{}")
    ap.add_argument("--limit", type=int, default=50)
    args = ap.parse_args()
    db = Path(args.db)
    conn = connect(db)
    setup(conn)

    if args.command == "init":
        print(json.dumps({"ok": True, "db": str(db)}))
        return 0
    if args.command == "put":
        state = json.loads(args.payload)
        rec = put_checkpoint(conn, args.thread, args.stage, state)
        print(json.dumps(rec, indent=2))
        return 0
    if args.command == "get":
        latest = get_latest(conn, args.thread)
        print(json.dumps(latest, indent=2, default=str))
        return 0 if latest else 1
    if args.command == "history":
        print(json.dumps(history(conn, args.thread, args.limit), indent=2))
        return 0
    return 1


if __name__ == "__main__":
    sys.exit(main())
