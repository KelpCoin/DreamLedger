#!/usr/bin/env python3
"""CI guard: bridge work requires a blocker bound to the active probe."""
import json
import os
import sys
from pathlib import Path

ACTIVE_PROBE_FILE = Path("logs/active_probe.json")
BRIDGE_PREFIXES = ("ops/", "supabase/functions/_shared/")


def main() -> int:
    if not ACTIVE_PROBE_FILE.exists():
        print("no active probe -> bridge freeze inactive")
        return 0

    probe = json.loads(ACTIVE_PROBE_FILE.read_text(encoding="utf-8"))
    probe_id = probe.get("probe_id")
    blocker = os.environ.get("BRIDGE_BLOCKER", "").strip()

    if not probe_id:
        print("BRIDGE FREEZE: active probe file has no probe_id")
        return 1

    if not blocker or not blocker.startswith(probe_id + ":") or len(blocker.split(":", 1)[1].strip()) < 10:
        print(f"BRIDGE FREEZE: active probe {probe_id} in flight.")
        print("Bridge change requires BRIDGE_BLOCKER='<probe_id>:<specific blocker>'.")
        return 1

    print(f"bridge change authorized for {probe_id}: {blocker}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
