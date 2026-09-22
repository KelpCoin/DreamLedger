#!/usr/bin/env python3
"""
CORTEX Builder v1 — Issue #304 helper.

Deterministic scan/replace for user-facing names only.
Preserves kelplantis_* technical identifiers.
Does not commit, merge, deploy, or contact anyone.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
from pathlib import Path

# User-facing tokens to rewrite (order matters for multi-pass safety)
REPLACEMENTS = [
    (re.compile(r"\bFinhaven\b"), "PhinHaven"),
    (re.compile(r"\bFINHAVEN\b"), "PhinHaven"),
    (re.compile(r"\bfinhaven\b"), "PhinHaven"),
    (re.compile(r"\bKelplantis\b"), "PhinHaven"),
    (re.compile(r"\bKELPLANTIS\b"), "PhinHaven"),
]

# Lines containing these must not have technical identifiers altered.
# We never rewrite the substring kelplantis_ / kelplantis-
TECHNICAL = re.compile(r"kelplantis[_-]", re.I)

SKIP_DIRS = {
    ".git",
    "node_modules",
    ".next",
    "dist",
    "build",
    "__pycache__",
    ".venv",
    "venv",
}

# Binary / non-text
SKIP_SUFFIXES = {
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".ico",
    ".pdf",
    ".zip",
    ".gz",
    ".woff",
    ".woff2",
    ".ttf",
    ".eot",
    ".mp4",
    ".wasm",
    ".lock",
}


def iter_files(root: Path):
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for name in filenames:
            p = Path(dirpath) / name
            if p.suffix.lower() in SKIP_SUFFIXES:
                continue
            yield p


def technical_tokens(text: str) -> set[str]:
    return set(m.group(0) for m in re.finditer(r"kelplantis[_-][A-Za-z0-9_]*", text, re.I))


def transform_line(line: str) -> str:
    # Never rewrite lines that only exist as pure technical identifiers;
    # still allow user-facing words on the same line if present.
    out = line
    for pattern, repl in REPLACEMENTS:
        out = pattern.sub(repl, out)
    return out


def process_file(path: Path, apply: bool) -> dict:
    try:
        raw = path.read_text(encoding="utf-8")
    except (UnicodeDecodeError, OSError):
        return {"path": str(path), "skipped": True, "reason": "binary_or_unreadable"}

    before_tech = technical_tokens(raw)
    lines = raw.splitlines(keepends=True)
    new_lines = [transform_line(L) for L in lines]
    new_raw = "".join(new_lines)
    after_tech = technical_tokens(new_raw)

    invariant_ok = before_tech == after_tech
    changed = new_raw != raw

    if apply and changed and invariant_ok:
        path.write_text(new_raw, encoding="utf-8")

    return {
        "path": str(path),
        "changed": changed,
        "invariant_ok": invariant_ok,
        "before_tech_count": len(before_tech),
        "after_tech_count": len(after_tech),
        "applied": bool(apply and changed and invariant_ok),
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default=".", help="Repository root")
    ap.add_argument("--apply", action="store_true", help="Write changes (default: dry-run)")
    ap.add_argument("--proof", default="proof/cortex/job-304/rename_scan.json")
    args = ap.parse_args()

    root = Path(args.root).resolve()
    results = []
    for p in iter_files(root):
        # Stay inside write_scope preference: still scan all text for invariant proof
        rel = p.relative_to(root)
        results.append(process_file(p, apply=args.apply))

    changed = [r for r in results if r.get("changed")]
    failed_inv = [r for r in results if r.get("invariant_ok") is False]
    applied = [r for r in results if r.get("applied")]

    proof = {
        "schema": "browneye/cortex-builder-v1/rename-scan/v1",
        "job_id": "job-304",
        "mode": "apply" if args.apply else "dry-run",
        "root": str(root),
        "files_scanned": len(results),
        "files_changed": len(changed),
        "files_applied": len(applied),
        "invariant_failures": len(failed_inv),
        "invariant_ok": len(failed_inv) == 0,
        "changed_paths": [r["path"] for r in changed][:500],
        "failure_paths": [r["path"] for r in failed_inv][:100],
    }
    proof["hash"] = hashlib.sha256(
        json.dumps({k: v for k, v in proof.items() if k != "hash"}, sort_keys=True).encode()
    ).hexdigest()

    proof_path = Path(args.proof)
    proof_path.parent.mkdir(parents=True, exist_ok=True)
    proof_path.write_text(json.dumps(proof, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(proof, indent=2))

    if failed_inv:
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
