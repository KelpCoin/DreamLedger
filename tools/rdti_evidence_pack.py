#!/usr/bin/env python3
"""DreamLedger RDTI evidence extraction pack.

Extracts contemporaneous repository records into a reviewable evidence packet.
It does NOT determine RDTI eligibility, calculate a claim, or infer scientific/
technological uncertainty from commit messages. Unknown fields remain explicit.
"""

from __future__ import annotations
import argparse, hashlib, json, subprocess
from datetime import datetime, timezone
from pathlib import Path

SCHEMA = "dreamledger/rdti-evidence-pack/v1"

def git(repo: Path, *args: str) -> str:
    return subprocess.check_output(["git", "-C", str(repo), *args], text=True, stderr=subprocess.DEVNULL).strip()

def sha256(v: str) -> str:
    return hashlib.sha256(v.encode()).hexdigest()

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", default=".")
    ap.add_argument("--limit", type=int, default=50)
    ap.add_argument("--output", default="rdti-evidence-pack.json")
    a = ap.parse_args()
    repo = Path(a.repo).resolve()
    head = git(repo, "rev-parse", "HEAD")
    rows = []
    raw = git(repo, "log", f"-{max(1,a.limit)}", "--date=iso-strict",
              "--pretty=format:%H%x09%aI%x09%an%x09%s")
    for line in raw.splitlines():
        p = line.split("\t", 3)
        if len(p) != 4:
            continue
        sha, authored_at, author, subject = p
        try:
            names = git(repo, "show", "--format=", "--name-only", sha).splitlines()
        except subprocess.CalledProcessError:
            names = []
        rows.append({
            "record_type": "repository_activity",
            "commit_sha": sha,
            "authored_at": authored_at,
            "author": author,
            "subject": subject,
            "changed_paths": [x for x in names if x],
            "source": {"type":"git_commit","repository":str(repo),"commit":sha},
            "truth_status":"INTERNAL",
        })
    packet = {
        "schema": SCHEMA,
        "compiler_version": "1.0.0",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "truth_status": "INTERNAL",
        "promotion_status": "NOT_ELIGIBLE",
        "repository": str(repo),
        "head_commit": head,
        "record_count": len(rows),
        "rdti_review_fields": {
            "project_identifier": "NOT_ESTABLISHED",
            "core_activity": "NOT_ESTABLISHED",
            "supporting_activities": "NOT_ESTABLISHED",
            "scientific_or_technological_uncertainty": "NOT_ESTABLISHED",
            "new_knowledge_or_improvement": "NOT_ESTABLISHED",
            "systematic_approach": "NOT_ESTABLISHED",
            "test_or_experiment_results": "NOT_ESTABLISHED",
            "eligible_expenditure": "NOT_ESTABLISHED",
            "entity_eligibility": "NOT_ESTABLISHED",
            "activity_location": "NOT_ESTABLISHED",
        },
        "records": rows,
        "limitations": [
            "Git history is contemporaneous technical evidence input, not independent authority.",
            "Commit messages and changed paths do not establish RDTI eligibility.",
            "No expenditure, tax credit, legal, or compliance conclusion is produced.",
            "Human/qualified-adviser review is required before any claim or submission.",
            "The packet deliberately leaves statutory review fields unresolved rather than inventing facts."
        ],
        "source_authority": [
            "IRD RDTI Guidance IR1240",
            "IRD RDTI record-keeping requirements"
        ],
    }
    canonical = json.dumps(packet, sort_keys=True, separators=(",",":"))
    packet["evidence_hash"] = sha256(canonical)
    Path(a.output).write_text(json.dumps(packet, indent=2)+"\n", encoding="utf-8")
    print(json.dumps({"ok":True,"schema":SCHEMA,"head_commit":head,
                      "record_count":len(rows),"evidence_hash":packet["evidence_hash"],
                      "output":a.output}, indent=2))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
