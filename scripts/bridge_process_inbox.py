#!/usr/bin/env python3
"""Process Agent Bridge inbox: validate pings, emit pongs, archive.
Air-gap safe. revenue always 0 in automated pongs.
"""
from __future__ import annotations

import argparse
import json
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INBOX = ROOT / "AGENT_BUS" / "BRIDGE" / "inbox"
OUTBOX = ROOT / "AGENT_BUS" / "BRIDGE" / "outbox"
ARCHIVE = ROOT / "AGENT_BUS" / "BRIDGE" / "archive"


def utc() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def load_json(p: Path):
    return json.loads(p.read_text(encoding="utf-8"))


def classify_ping(ping: dict) -> dict:
    """Validate context declarations without performing I/O or external effects."""
    schema = ping.get("schema", "")
    intent = str(ping.get("intent") or "").lower()
    summary_lower = str(ping.get("summary") or "").lower()
    reads = set(ping.get("reads") or [])
    commercial = intent in {"money", "commercial", "sell", "acquire"} or any(
        word in summary_lower
        for word in ("revenue", "buyer", "checkout", "payment", "offer", "distribution", "commercial", "sell")
    )
    beck = any(
        word in summary_lower
        for word in (
            "beck", "bec-prime", "bounded runtime", "agent approval", "action governance",
            "policy enforcement", "approval token", "signed receipt", "agent guardrail",
            "pypi", "langchain", "crewai", "autogen", "llamaindex", "mcp gateway",
        )
    )
    required_reads = {"AGENT_BUS/BRIDGE/PROTOCOL.md", "AGENT_BUS/MONEY-PLAYBOOK-500.md"}
    required_beck_reads = {"AGENT_BUS/BRIDGE/BECK_PRODUCTIZATION_GTM.md"}
    if "agent-bridge-ping" not in schema:
        status, summary = "rejected", "invalid schema"
    elif float(ping.get("revenue_claim_nzd") or 0) > 0:
        status, summary = "rejected", "revenue_claim_nzd must be 0 without fossil"
    elif commercial and not required_reads.issubset(reads):
        status, summary = "rejected", "commercial task must declare Agent Bridge protocol and canonical Money Playbook in reads"
    elif beck and not required_beck_reads.issubset(reads):
        status, summary = "rejected", "BECK/runtime governance task must declare BECK_PRODUCTIZATION_GTM.md in reads"
    else:
        status = "accepted"
        summary = f"accepted ball={ping.get('ball')} intent={ping.get('intent')}"
        if commercial:
            summary += " commercial-context=acknowledged"
        if beck:
            summary += " beck-productization-context=acknowledged"
    required_context = [
        "AGENT_BUS/BRIDGE/PROTOCOL.md",
        "AGENT_BUS/MONEY-PLAYBOOK-500.md",
        "AGENT_BUS/MONEY-PLAYBOOK-INDEX.json",
    ]
    if commercial:
        required_context.append("AGENT_BUS/BRIDGE/COMMERCIAL_ROUTES_CATALOG.md")
    if beck:
        required_context.append("AGENT_BUS/BRIDGE/BECK_PRODUCTIZATION_GTM.md")
    return {
        "status": status,
        "summary": summary,
        "commercial_context_required": commercial,
        "beck_context_required": beck,
        "required_context": required_context,
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--from", dest="frm", default="bridge-router")
    args = ap.parse_args()

    INBOX.mkdir(parents=True, exist_ok=True)
    OUTBOX.mkdir(parents=True, exist_ok=True)
    ARCHIVE.mkdir(parents=True, exist_ok=True)

    files = sorted(INBOX.glob("*.json"))
    results = []
    for path in files:
        try:
            ping = load_json(path)
        except Exception as e:
            results.append({"file": path.name, "status": "rejected", "error": str(e)})
            continue

        decision = classify_ping(ping)
        status = decision["status"]
        summary = decision["summary"]

        pong_id = f"pong-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M')}-{uuid.uuid4().hex[:6]}"
        pong = {
            "schema": "dreamledger/agent-bridge-pong/v1",
            "pong_id": pong_id,
            "in_reply_to": ping.get("ping_id"),
            "from": args.frm,
            "status": status,
            "summary": summary,
            "verified_external_revenue_nzd": 0,
            "required_context": decision["required_context"],
            "commercial_context_required": decision["commercial_context_required"],
            "beck_context_required": decision["beck_context_required"],
            "next_ball": ping.get("ball") or "C",
            "created_at": utc(),
        }
        results.append({"file": path.name, "status": status, "pong_id": pong_id})

        if args.dry_run:
            continue

        (OUTBOX / f"{pong_id}.json").write_text(json.dumps(pong, indent=2) + "\n", encoding="utf-8")
        shutil.move(str(path), str(ARCHIVE / path.name))

    print(json.dumps({"ok": True, "processed": len(results), "dry_run": args.dry_run, "results": results}, indent=2))


if __name__ == "__main__":
    main()
