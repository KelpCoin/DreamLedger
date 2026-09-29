#!/usr/bin/env python3
"""Regression test for RDTI evidence packet generation, including binary Git patches."""
from __future__ import annotations

import hashlib
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path


def run(cwd: Path, *args: str) -> None:
    subprocess.run(args, cwd=cwd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def main() -> int:
    compiler = Path(__file__).with_name("rdti_evidence_pack.py").resolve()
    with tempfile.TemporaryDirectory(prefix="rdti-pack-test-") as temp:
        repo = Path(temp) / "fixture"
        repo.mkdir()
        run(repo, "git", "init", "-q")
        run(repo, "git", "config", "user.name", "Evidence Pack Test")
        run(repo, "git", "config", "user.email", "test@example.invalid")
        (repo / "notes.txt").write_text("initial technical note\n", encoding="utf-8")
        run(repo, "git", "add", "notes.txt")
        run(repo, "git", "commit", "-qm", "Add initial technical note")
        (repo / "notes.txt").write_text("changed technical note\n", encoding="utf-8")
        (repo / "fixture.bin").write_bytes(bytes([0, 255, 1, 2, 128, 10]))
        run(repo, "git", "add", "notes.txt", "fixture.bin")
        run(repo, "git", "commit", "-qm", "Update note and add binary fixture")
        json_path = Path(temp) / "pack.json"
        html_path = Path(temp) / "pack.html"
        subprocess.run([
            sys.executable, str(compiler), "--repo", str(repo), "--limit", "10",
            "--output", str(json_path), "--html-output", str(html_path),
        ], check=True, capture_output=True, text=True)
        packet = json.loads(json_path.read_text(encoding="utf-8"))
        rendered = html_path.read_text(encoding="utf-8")
        assert packet["record_count"] == 2, packet["record_count"]
        assert packet["truth_status"] == "INTERNAL"
        assert packet["promotion_status"] == "NOT_ELIGIBLE"
        assert all(len(row["patch_sha256"]) == 64 for row in packet["records"])
        assert all(all(ch in "0123456789abcdef" for ch in row["patch_sha256"]) for row in packet["records"])
        assert "fixture.bin" in rendered
        assert packet["evidence_hash"] == hashlib.sha256(
            json.dumps({k: v for k, v in packet.items() if k != "evidence_hash"},
                       sort_keys=True, separators=(",", ":")).encode("utf-8")
        ).hexdigest()
        assert "NOT_ESTABLISHED" in rendered
        assert "NOT AN ELIGIBILITY DECISION" in rendered
        print("RDTI_EVIDENCE_PACK_REGRESSION=PASS")
        print("FIXTURE_COMMITS=" + str(packet["record_count"]))
        print("BINARY_PATCH_HASH=PASS")
        print("HTML_RENDER=PASS")
        print("TRUTH_GUARD=PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
