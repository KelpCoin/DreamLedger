#!/usr/bin/env python3
"""Build a reviewable RDTI evidence-input packet from authorized Git history.

This tool records source history only. It does not determine eligibility,
infer technological uncertainty, calculate expenditure, or submit a claim.
"""
from __future__ import annotations

import argparse
import hashlib
import html
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path

SCHEMA = "dreamledger/rdti-evidence-pack/v1"
VERSION = "1.1.0"


def git(repo: Path, *args: str) -> str:
    return subprocess.check_output(
        ["git", "-C", str(repo), *args],
        text=True,
        stderr=subprocess.DEVNULL,
    ).strip()


def sha256(value: str | bytes) -> str:
    raw = value if isinstance(value, bytes) else value.encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def git_bytes(repo: Path, *args: str) -> bytes:
    return subprocess.check_output(["git", "-C", str(repo), *args], stderr=subprocess.DEVNULL)


def render_html(packet: dict) -> str:
    esc = lambda value: html.escape(str(value), quote=True)
    fields = "".join(
        "<tr><th>" + esc(key.replace("_", " ")) + "</th><td>" + esc(value) + "</td></tr>"
        for key, value in packet["rdti_review_fields"].items()
    )
    commits = []
    for row in packet["records"]:
        paths = "<br>".join(esc(path) for path in row["changed_paths"]) or "(no paths recorded)"
        commits.append(
            "<tr><td><code>" + esc(row["commit_sha"]) + "</code></td>"
            "<td>" + esc(row["authored_at"]) + "</td>"
            "<td>" + esc(row["subject"]) + "</td>"
            "<td>" + paths + "</td>"
            "<td><code>" + esc(row["patch_sha256"]) + "</code></td>"
            "<td>" + esc(row["truth_status"]) + "</td></tr>"
        )
    limitations = "".join("<li>" + esc(item) + "</li>" for item in packet["limitations"])
    return """<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>RDTI Evidence Input Pack</title>
<style>
body{font:16px/1.55 system-ui,sans-serif;max-width:1100px;margin:32px auto;padding:0 18px;color:#18202b}
h1,h2{line-height:1.2} .warning{padding:14px;border:2px solid #a66b00;background:#fff6dc}
.meta{overflow-wrap:anywhere}table{border-collapse:collapse;width:100%;margin:18px 0}
th,td{border:1px solid #ccd2da;padding:8px;text-align:left;vertical-align:top}
th{background:#f1f3f6}code{overflow-wrap:anywhere;font-size:.85em}
.badge{font-weight:800;color:#8b4d00}li{margin:.35em 0}
</style></head><body>
<h1>RDTI technical evidence input pack</h1>
<div class="warning"><strong>RESEARCH SUPPORT ONLY · NOT AN ELIGIBILITY DECISION</strong><br>
Repository history is an evidence input. It does not prove RDTI eligibility, expenditure,
scientific or technological uncertainty, or claim entitlement. Qualified review is required.</div>
<h2>Packet identity</h2><p class="meta"><b>Schema:</b> """ + esc(packet["schema"]) + """<br>
<b>Compiler:</b> """ + esc(packet["compiler_version"]) + """<br>
<b>Generated (UTC):</b> """ + esc(packet["generated_at"]) + """<br>
<b>Repository path:</b> """ + esc(packet["repository"]) + """<br>
<b>Head commit:</b> <code>""" + esc(packet["head_commit"]) + """</code><br>
<b>Records:</b> """ + esc(packet["record_count"]) + """<br>
<b>Packet SHA-256:</b> <code>""" + esc(packet["evidence_hash"]) + """</code><br>
<b>Truth status:</b> <span class="badge">""" + esc(packet["truth_status"]) + """</span><br>
<b>Promotion status:</b> <span class="badge">""" + esc(packet["promotion_status"]) + """</span></p>
<h2>Required reviewer fields</h2><table><thead><tr><th>Field</th><th>Status</th></tr></thead><tbody>""" + fields + """</tbody></table>
<h2>Source commit ledger</h2><p>Each patch hash fingerprints the commit patch bytes emitted by Git. Changed paths are
historical path names, not proof that the current file contents match a past state.</p>
<table><thead><tr><th>Commit</th><th>Authored</th><th>Subject</th><th>Changed paths</th><th>Patch SHA-256</th><th>Classification</th></tr></thead><tbody>""" + "".join(commits) + """</tbody></table>
<h2>Limitations</h2><ul>""" + limitations + """</ul>
<p>Source authorities to consult separately: """ + esc(", ".join(packet["source_authority"])) + """.
This packet does not fetch or independently verify those authorities.</p>
</body></html>
"""


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", default=".")
    ap.add_argument("--limit", type=int, default=50)
    ap.add_argument("--output", default="rdti-evidence-pack.json")
    ap.add_argument("--html-output", default="rdti-evidence-pack.html")
    a = ap.parse_args()
    repo = Path(a.repo).resolve()
    head = git(repo, "rev-parse", "HEAD")
    rows = []
    raw = git(repo, "log", f"-{max(1, min(a.limit, 500))}", "--date=iso-strict",
              "--pretty=format:%H%x09%aI%x09%an%x09%s")
    for line in raw.splitlines():
        parts = line.split("\t", 3)
        if len(parts) != 4:
            continue
        commit_sha, authored_at, author, subject = parts
        names = git(repo, "show", "--format=", "--name-only", commit_sha).splitlines()
        patch = git_bytes(repo, "show", "--format=", "--binary", commit_sha)
        rows.append({
            "record_type": "repository_activity",
            "commit_sha": commit_sha,
            "authored_at": authored_at,
            "author": author,
            "subject": subject,
            "changed_paths": [name for name in names if name],
            "patch_sha256": sha256(patch),
            "source": {"type": "git_commit", "repository": str(repo), "commit": commit_sha},
            "truth_status": "INTERNAL",
        })
    packet = {
        "schema": SCHEMA,
        "compiler_version": VERSION,
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
            "Patch hashes identify recorded Git patch bytes; they do not prove the truth of the patch description.",
            "No expenditure, tax credit, legal, or compliance conclusion is produced.",
            "Human/qualified-adviser review is required before any claim or submission.",
            "The packet deliberately leaves statutory review fields unresolved rather than inventing facts.",
            "Referenced source authorities are named for review but are not fetched or independently verified by this compiler.",
        ],
        "source_authority": [
            "IRD RDTI Guidance IR1240",
            "IRD RDTI record-keeping requirements",
        ],
    }
    canonical = json.dumps(packet, sort_keys=True, separators=(",", ":"))
    packet["evidence_hash"] = sha256(canonical)
    Path(a.output).write_text(json.dumps(packet, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    Path(a.html_output).write_text(render_html(packet), encoding="utf-8")
    print(json.dumps({
        "ok": True,
        "schema": SCHEMA,
        "compiler_version": VERSION,
        "head_commit": head,
        "record_count": len(rows),
        "evidence_hash": packet["evidence_hash"],
        "json_output": a.output,
        "html_output": a.html_output,
        "truth_status": packet["truth_status"],
        "promotion_status": packet["promotion_status"],
    }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
