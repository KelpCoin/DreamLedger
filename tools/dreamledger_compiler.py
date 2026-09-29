#!/usr/bin/env python3
"""
DreamLedger Evidence Compiler
Deterministic repository evidence manifest.

This tool compiles repository history into a machine-readable evidence packet.
It does not make tax, legal, revenue, or compliance determinations.
Outputs are INTERNAL/TEST unless independently promoted by the truth layer.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path


SCHEMA = "dreamledger/evidence-compilation/v1"


def run_git(*args: str) -> str:
    return subprocess.check_output(
        ["git", *args],
        text=True,
        stderr=subprocess.DEVNULL,
    ).strip()


def sha256(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", default=".")
    parser.add_argument("--limit", type=int, default=25)
    parser.add_argument("--output", default="evidence-compilation.json")
    args = parser.parse_args()

    repo = Path(args.repo).resolve()
    commit_count = int(run_git("-C", str(repo), "rev-list", "--count", "HEAD") or "0")
    head = run_git("-C", str(repo), "rev-parse", "HEAD")

    raw = run_git(
        "-C", str(repo),
        "log",
        f"-{max(1, args.limit)}",
        "--date=iso-strict",
        "--pretty=format:%H%x09%aI%x09%an%x09%s",
    )

    commits = []
    for line in raw.splitlines():
        parts = line.split("\t", 3)
        if len(parts) != 4:
            continue
        commit_sha, authored_at, author, subject = parts
        commits.append(
            {
                "commit_sha": commit_sha,
                "authored_at": authored_at,
                "author": author,
                "subject": subject,
            }
        )

    changed_files = []
    if commits:
        recent = commits[0]["commit_sha"]
        try:
            diff = run_git(
                "-C", str(repo),
                "show",
                "--format=",
                "--name-status",
                recent,
            )
            for line in diff.splitlines():
                parts = line.split("\t")
                if len(parts) >= 2:
                    changed_files.append(
                        {"status": parts[0], "path": parts[-1]}
                    )
        except subprocess.CalledProcessError:
            pass

    packet = {
        "schema": SCHEMA,
        "compiler_version": "1.0.0",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "truth_status": "INTERNAL",
        "promotion_status": "NOT_ELIGIBLE",
        "repository": str(repo),
        "head_commit": head,
        "repository_commit_count": commit_count,
        "observed_commits": commits,
        "latest_commit_changed_files": changed_files,
        "limitations": [
            "Repository history is evidence input, not independent external proof.",
            "No tax, legal, revenue, or compliance conclusion is produced.",
            "Promotion requires an external authority and the DreamLedger truth gate.",
        ],
    }

    canonical = json.dumps(packet, sort_keys=True, separators=(",", ":"))
    packet["evidence_hash"] = sha256(canonical)

    output = Path(args.output)
    output.write_text(json.dumps(packet, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "ok": True,
        "schema": SCHEMA,
        "truth_status": packet["truth_status"],
        "head_commit": head,
        "observed_commits": len(commits),
        "changed_files": len(changed_files),
        "evidence_hash": packet["evidence_hash"],
        "output": str(output),
    }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
