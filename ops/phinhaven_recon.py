#!/usr/bin/env python3
"""Deterministic PHINHAVEN canonical-runtime reconnaissance.

This tool inventories evidence. It never creates or modifies game runtime files.
Run from the repository root:
    python ops/phinhaven_recon.py --output PHINHAVEN_RECON_V0.1.json
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
from pathlib import Path

LEGACY_PREFIXES = ("kelplantis", "finhaven")
IGNORED_DIRS = {".git", ".venv", "node_modules", "__pycache__", ".godot"}
TEXT_SUFFIXES = {".gd", ".tscn", ".tres", ".gdshader", ".sql", ".md", ".json", ".yml", ".yaml", ".toml", ".py", ".ts", ".tsx", ".js", ".html"}


def git_sha(root: Path) -> str:
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "HEAD"], cwd=root, text=True, stderr=subprocess.DEVNULL
        ).strip()
    except Exception:
        return "UNKNOWN"


def tracked_files(root: Path) -> list[str]:
    try:
        raw = subprocess.check_output(
            ["git", "ls-files"], cwd=root, text=True, stderr=subprocess.DEVNULL
        )
        return [x for x in raw.splitlines() if x]
    except Exception:
        out = []
        for p in root.rglob("*"):
            if p.is_file() and not any(part in IGNORED_DIRS for part in p.parts):
                out.append(p.relative_to(root).as_posix())
        return sorted(out)


def read_text(path: Path) -> str:
    if path.suffix.lower() not in TEXT_SUFFIXES:
        return ""
    try:
        return path.read_text(encoding="utf-8", errors="replace")
    except Exception:
        return ""


def classify(root: Path, rel: str) -> dict:
    path = root / rel
    name = path.name.lower()
    lower = rel.lower()
    text = read_text(path)
    rpc_count = len(re.findall(r"@rpc\s*\(", text)) if text else 0
    return {
        "path": rel,
        "kind": "file",
        "size_bytes": path.stat().st_size,
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "legacy_reference": any(token in lower for token in LEGACY_PREFIXES),
        "rpc_declarations": rpc_count,
        "signals": {
            "godot_project": name == "project.godot",
            "godot_scene": path.suffix.lower() == ".tscn",
            "godot_script": path.suffix.lower() == ".gd",
            "supabase_migration": "/migrations/" in lower and path.suffix.lower() == ".sql",
        },
    }


def component_state(inventory: list[dict], predicate) -> str:
    return "PRESENT" if any(predicate(x) for x in inventory) else "MISSING"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", default=".")
    parser.add_argument("--output", default="PHINHAVEN_RECON_V0.1.json")
    args = parser.parse_args()

    root = Path(args.root).resolve()
    files = tracked_files(root)
    inventory = [classify(root, rel) for rel in files]
    scenes = [x["path"] for x in inventory if x["signals"]["godot_scene"]]
    scripts = [x["path"] for x in inventory if x["signals"]["godot_script"]]
    migrations = [x["path"] for x in inventory if x["signals"]["supabase_migration"]]
    rpcs = [x for x in inventory if x["rpc_declarations"] > 0]
    project_files = [x["path"] for x in inventory if x["signals"]["godot_project"]]

    recon = {
        "schema": "PHINHAVEN-RECON/v0.1",
        "status": "BLOCKED",
        "project": "PHINHAVEN",
        "canonical_repository": "KelpCoin/DreamLedger",
        "git_sha": git_sha(root),
        "scanned_root": str(root),
        "classification": {
            "runtime": component_state(inventory, lambda x: x["signals"]["godot_project"]),
            "godot_project": "PRESENT" if project_files else "MISSING",
            "scenes": "PRESENT" if scenes else "MISSING",
            "player_scripts": "UNKNOWN",
            "rpc_contracts": "PRESENT" if rpcs else "MISSING",
            "supabase_game_migrations": "PRESENT" if migrations else "MISSING",
        },
        "evidence": {
            "project_files": project_files,
            "scene_files": scenes,
            "godot_scripts": scripts,
            "rpc_files": [x["path"] for x in rpcs],
            "supabase_game_migrations": migrations,
            "tracked_file_count": len(inventory),
        },
        "legacy_references": [x["path"] for x in inventory if x["legacy_reference"]],
        "rules": [
            "Canonical repository outranks sandbox, screenshots, old builds, chat claims, and generated files.",
            "Database migrations are backend evidence, not executable Godot proof.",
            "No gameplay implementation is performed by this scanner.",
            "RECON VERIFIED requires sufficient evidence to establish the executable runtime and its authority chain.",
        ],
        "blockers": [
            "Runtime cannot be promoted from database evidence alone." if not project_files else "Runtime requires manual scene/controller reconciliation.",
        ],
    }

    output = root / args.output
    output.write_text(json.dumps(recon, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(recon, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
