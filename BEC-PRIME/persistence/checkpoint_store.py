#!/usr/bin/env python3
"""
Air-gap checkpoint store (LangGraph-compatible mental model).

- thread_id: stable job key
- checkpoints: ordered full stage snapshots (like put)
- pending_writes: task-level outputs within a super-step (like put_writes)
- SQLite: BEC-PRIME/persistence/data/checkpoints.sqlite

No network. No Stripe. No revenue claims.

  python BEC-PRIME/persistence/checkpoint_store.py init
  python BEC-PRIME/persistence/checkpoint_store.py put --thread THREAD-FIRST-SALE --stage SHARE --payload '{"done":true}'
  python BEC-PRIME/persistence/checkpoint_store.py put-writes --thread T --super-step 1 --task node_a --payload '{"channel":"x","value":1}'
  python BEC-PRIME/persistence/checkpoint_store.py list-pending --thread T --super-step 1
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

        -- LangGraph-style pending / task writes (intra super-step)
        CREATE TABLE IF NOT EXISTS pending_writes (
          write_id TEXT PRIMARY KEY,
          thread_id TEXT NOT NULL,
          super_step INTEGER NOT NULL,
          task_id TEXT NOT NULL,
          created_at TEXT NOT NULL,
          writes_json TEXT NOT NULL,
          applied INTEGER NOT NULL DEFAULT 0,
          UNIQUE(thread_id, super_step, task_id),
          FOREIGN KEY(thread_id) REFERENCES threads(thread_id)
        );
        CREATE INDEX IF NOT EXISTS idx_pw_thread_step
          ON pending_writes(thread_id, super_step);
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


def put_writes(
    conn: sqlite3.Connection,
    thread_id: str,
    super_step: int,
    task_id: str,
    writes: dict | list,
) -> dict:
    """Record task-level outputs (LangGraph put_writes analogue)."""
    ensure_thread(conn, thread_id)
    write_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    body = {
        "v": 1,
        "task_id": task_id,
        "super_step": super_step,
        "writes": writes,
        "policy": "Pending writes are not revenue. Side effects already done are not undone.",
    }
    conn.execute(
        """
        INSERT INTO pending_writes(write_id, thread_id, super_step, task_id, created_at, writes_json, applied)
        VALUES (?,?,?,?,?,?,0)
        ON CONFLICT(thread_id, super_step, task_id) DO UPDATE SET
          write_id=excluded.write_id,
          created_at=excluded.created_at,
          writes_json=excluded.writes_json,
          applied=0
        """,
        (write_id, thread_id, int(super_step), task_id, now, json.dumps(body)),
    )
    conn.execute("UPDATE threads SET updated_at=? WHERE thread_id=?", (now, thread_id))
    conn.commit()
    return {
        "write_id": write_id,
        "thread_id": thread_id,
        "super_step": int(super_step),
        "task_id": task_id,
        "created_at": now,
    }


def list_pending(
    conn: sqlite3.Connection,
    thread_id: str,
    super_step: int | None = None,
) -> list:
    if super_step is None:
        rows = conn.execute(
            "SELECT * FROM pending_writes WHERE thread_id=? ORDER BY super_step, task_id",
            (thread_id,),
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM pending_writes WHERE thread_id=? AND super_step=? ORDER BY task_id",
            (thread_id, int(super_step)),
        ).fetchall()
    out = []
    for r in rows:
        out.append(
            {
                "write_id": r["write_id"],
                "thread_id": r["thread_id"],
                "super_step": r["super_step"],
                "task_id": r["task_id"],
                "created_at": r["created_at"],
                "applied": bool(r["applied"]),
                "body": json.loads(r["writes_json"]),
            }
        )
    return out


def clear_pending(conn: sqlite3.Connection, thread_id: str, super_step: int) -> int:
    cur = conn.execute(
        "DELETE FROM pending_writes WHERE thread_id=? AND super_step=?",
        (thread_id, int(super_step)),
    )
    conn.commit()
    return cur.rowcount


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
    ap.add_argument(
        "command",
        choices=["init", "put", "get", "history", "put-writes", "list-pending", "clear-pending"],
    )
    ap.add_argument("--db", default=str(DEFAULT_DB))
    ap.add_argument("--thread", default="THREAD-FIRST-SALE")
    ap.add_argument("--stage", default="UNKNOWN")
    ap.add_argument("--payload", default="{}")
    ap.add_argument("--limit", type=int, default=50)
    ap.add_argument("--super-step", type=int, default=1)
    ap.add_argument("--task", default="task")
    args = ap.parse_args()
    db = Path(args.db)
    conn = connect(db)
    setup(conn)

    if args.command == "init":
        print(json.dumps({"ok": True, "db": str(db), "features": ["checkpoints", "pending_writes"]}))
        return 0
    if args.command == "put":
        state = json.loads(args.payload)
        rec = put_checkpoint(conn, args.thread, args.stage, state)
        print(json.dumps(rec, indent=2))
        return 0
    if args.command == "put-writes":
        writes = json.loads(args.payload)
        rec = put_writes(conn, args.thread, args.super_step, args.task, writes)
        print(json.dumps(rec, indent=2))
        return 0
    if args.command == "list-pending":
        print(json.dumps(list_pending(conn, args.thread, args.super_step), indent=2))
        return 0
    if args.command == "clear-pending":
        n = clear_pending(conn, args.thread, args.super_step)
        print(json.dumps({"cleared": n, "thread_id": args.thread, "super_step": args.super_step}))
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
