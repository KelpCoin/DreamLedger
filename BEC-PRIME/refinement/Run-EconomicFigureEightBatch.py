#!/usr/bin/env python3
"""Run the existing Figure Eight refinement lane across a bounded economic seed set.

This is orchestration, not a new economic engine. Every seed remains a hypothesis.
No public action, checkout, outreach, price change, or revenue assertion occurs here.
"""

import argparse
import json
import os
import subprocess
import sys


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--seeds", default=os.path.join("BEC-PRIME", "refinement", "economic-figure-eight-seeds.json"))
    p.add_argument("--engine", default=os.path.join("BEC-PRIME", "refinement", "MultiLMRefinementEngine.py"))
    p.add_argument("--models", required=True)
    p.add_argument("--sequential-load", action="store_true")
    p.add_argument("--gpu", default="0.35")
    p.add_argument("--context-length", type=int, default=4096)
    p.add_argument("--lms-path", default=None)
    p.add_argument("--limit", type=int, default=0)
    p.add_argument("--out-dir", default=os.path.join("BEC-PRIME", "data", "refinement"))
    args = p.parse_args()

    with open(args.seeds, "r", encoding="utf-8") as f:
        data = json.load(f)

    seeds = data["seeds"][:args.limit or None]
    results = []

    for seed in seeds:
        cmd = [
            sys.executable, args.engine,
            "--signal", seed["signal"],
            "--silo", seed["silo"],
            "--models", args.models,
            "--out-dir", args.out_dir,
            "--gpu", args.gpu,
            "--context-length", str(args.context_length),
        ]
        if args.sequential_load:
            cmd.append("--sequential-load")
        if args.lms_path:
            cmd.extend(["--lms-path", args.lms_path])

        proc = subprocess.run(cmd, capture_output=True, text=True)
        result = {
            "seed_id": seed["id"],
            "family": seed["family"],
            "returncode": proc.returncode,
            "stdout_tail": proc.stdout[-4000:],
            "stderr_tail": proc.stderr[-2000:],
            "status": "RUNTIME_RESULT_OBSERVED" if proc.returncode in (0, 1) else "RUNTIME_ERROR",
        }
        results.append(result)

        # Continue through the portfolio. One failed candidate must not suppress
        # the remaining economic search space.
        print(json.dumps(result, indent=2))

    print(json.dumps({
        "schema_version": "BEC-FIGURE-EIGHT-BATCH-1.0",
        "claim_boundary": "HYPOTHESIS_ONLY_NO_REVENUE_CLAIM",
        "seed_count": len(seeds),
        "results": results,
    }, indent=2))
    return 0 if all(r["returncode"] in (0, 1) for r in results) else 2


if __name__ == "__main__":
    raise SystemExit(main())
