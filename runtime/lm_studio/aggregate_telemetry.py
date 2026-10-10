#!/usr/bin/env python3
"""Aggregate BECK runtime telemetry without inventing local inference costs or revenue."""
import argparse, json, statistics
from pathlib import Path

def aggregate(paths):
    runs = []
    for path in paths:
        try:
            row = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            continue
        if row.get("schema") == "BEC/LOCAL-CORTEX-SIGNAL-GAUNTLET/v1":
            runs.append(row)
    groups = {}
    for row in runs:
        meta = row.get("provider") or {}
        key = (str(meta.get("task_class") or "unknown"), str(meta.get("provider") or "unknown"), str(meta.get("model") or "unknown"))
        group = groups.setdefault(key, {"runs": 0, "latencies_ms": [], "input_tokens": 0, "input_token_observations": 0, "output_tokens": 0, "output_token_observations": 0, "fallbacks": 0, "gauntlet_passes": 0})
        group["runs"] += 1
        if isinstance(meta.get("latency_ms"), (int, float)): group["latencies_ms"].append(meta["latency_ms"])
        if isinstance(meta.get("input_tokens"), int): group["input_tokens"] += meta["input_tokens"]; group["input_token_observations"] += 1
        if isinstance(meta.get("output_tokens"), int): group["output_tokens"] += meta["output_tokens"]; group["output_token_observations"] += 1
        group["fallbacks"] += int(bool(meta.get("fallback")))
        group["gauntlet_passes"] += int((row.get("gauntlet") or {}).get("decision") == "PASS")
    summaries = []
    for (task_class, provider, model), g in sorted(groups.items()):
        summaries.append({
            "task_class": task_class, "provider": provider, "model": model, "runs": g["runs"],
            "mean_latency_ms": round(statistics.mean(g["latencies_ms"]), 2) if g["latencies_ms"] else None,
            "input_tokens_total_observed": g["input_tokens"] if g["input_token_observations"] else None,
            "output_tokens_total_observed": g["output_tokens"] if g["output_token_observations"] else None,
            "token_observations": {"input": g["input_token_observations"], "output": g["output_token_observations"]},
            "fallbacks": g["fallbacks"], "gauntlet_passes_not_revenue": g["gauntlet_passes"],
            "estimated_cost": None, "cost_per_verified_economic_outcome": None
        })
    return {"schema": "BEC/LOCAL-RUNTIME-TELEMETRY/v1", "artifact_count": len(runs), "groups": summaries, "verified_external_revenue_nzd": 0, "verified_economic_outcomes": 0, "cost_not_estimated_without_cost_basis": True}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--runs", default=str(Path(__file__).with_name("runs")))
    args = parser.parse_args()
    root = Path(args.runs)
    paths = list(root.glob("signal-*.json")) if root.is_dir() else []
    print(json.dumps(aggregate(paths), indent=2))
if __name__ == "__main__": main()
