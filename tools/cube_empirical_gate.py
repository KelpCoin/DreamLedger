#!/usr/bin/env python3
"""CUBE empirical gate.

Consumes REAL observed swarm traces only. No synthetic success is accepted.
Expected JSONL fields:
task_id, strategy, success, cell_id(optional), action_id(optional), timestamp(optional)

strategy values should include:
single_cell, cube_swarm, pressure_field, conversation, hierarchy

The gate reports:
- CUBE swarm success rate vs 6.7% Molt Dynamics reference
- paired/aggregate comparison vs single-cell baseline
- pressure-field comparison when all strategies are present
- explicit NO_DATA/NO_GO when evidence is missing
"""
from __future__ import annotations

import json
import os
import statistics
import sys
from collections import defaultdict

MOLT_BASELINE = 0.067
REQUIRED = {"task_id", "strategy", "success"}


def load(path: str):
    rows = []
    with open(path, encoding="utf-8") as f:
        for n, line in enumerate(f, 1):
            if not line.strip():
                continue
            row = json.loads(line)
            missing = REQUIRED - row.keys()
            if missing:
                raise ValueError(f"line {n}: missing {sorted(missing)}")
            row["success"] = bool(row["success"])
            rows.append(row)
    return rows


def rate(rows):
    return sum(r["success"] for r in rows) / len(rows) if rows else None


def main():
    path = os.environ.get("CUBE_TRACE_PATH", "runtime/777/cube-swarm-traces.jsonl")
    if not os.path.exists(path):
        print(json.dumps({
            "status": "NO_DATA",
            "gate": "NO_GO",
            "reason": "REAL_CUBE_TRACE_FILE_MISSING",
            "required_path": path,
            "molt_reference_success_rate": MOLT_BASELINE,
            "verified_external_revenue_nzd": 0.0,
        }, indent=2))
        return 2

    rows = load(path)
    by = defaultdict(list)
    for r in rows:
        by[r["strategy"]].append(r)

    cube = rate(by.get("cube_swarm", []))
    single = rate(by.get("single_cell", []))
    pressure = rate(by.get("pressure_field", []))
    conversation = rate(by.get("conversation", []))
    hierarchy = rate(by.get("hierarchy", []))

    result = {
        "status": "OBSERVED",
        "gate": "HOLD",
        "sample_counts": {k: len(v) for k, v in by.items()},
        "success_rates": {
            "cube_swarm": cube,
            "single_cell": single,
            "pressure_field": pressure,
            "conversation": conversation,
            "hierarchy": hierarchy,
        },
        "molt_reference_success_rate": MOLT_BASELINE,
        "verified_external_revenue_nzd": 0.0,
        "independent_external_buyers": 0,
    }

    if cube is None:
        result["status"] = "INCOMPLETE"
        result["reason"] = "CUBE_SWARM_TRACE_MISSING"
        print(json.dumps(result, indent=2))
        return 2

    beats_molt = cube > MOLT_BASELINE
    beats_single = single is not None and cube > single
    result["beats_molt_reference"] = beats_molt
    result["beats_single_cell"] = beats_single

    pressure_present = all(x is not None for x in (pressure, conversation, hierarchy))
    if pressure_present:
        result["pressure_field_comparison"] = {
            "pressure_field": pressure,
            "conversation": conversation,
            "hierarchy": hierarchy,
            "pressure_field_beats_conversation": pressure > conversation,
            "pressure_field_beats_hierarchy": pressure > hierarchy,
        }
    else:
        result["pressure_field_comparison"] = "INCOMPLETE"

    # Scale only when CUBE beats the empirical reference and its matched
    # single-cell control. Missing controls remain HOLD, never PASS.
    if beats_molt and beats_single:
        result["gate"] = "PASS_SCALE_EXPERIMENT"
    else:
        result["gate"] = "NO_GO_SCALE"

    print(json.dumps(result, indent=2))
    return 0 if result["gate"] == "PASS_SCALE_EXPERIMENT" else 1


if __name__ == "__main__":
    raise SystemExit(main())
