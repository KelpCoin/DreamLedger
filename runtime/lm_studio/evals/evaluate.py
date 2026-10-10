#!/usr/bin/env python3
"""Score saved predictions against labeled examples; never calls an LLM or network."""
import argparse, json
from pathlib import Path

def evaluate(examples, predictions):
    by_id = {row["id"]: row for row in predictions}
    total = correct = 0
    per_field = {}
    confusion = {}
    for example in examples:
        pred = by_id.get(example["id"], {}).get("prediction", {})
        for field, expected in example["expected"].items():
            total += 1
            match = pred.get(field) == expected
            correct += int(match)
            slot = per_field.setdefault(field, {"correct": 0, "total": 0})
            slot["correct"] += int(match)
            slot["total"] += 1
            if not match:
                key = field + "|" + str(expected) + "->" + str(pred.get(field, "<MISSING>"))
                confusion[key] = confusion.get(key, 0) + 1
    return {
        "schema": "BEC/ADLC-EVAL-REPORT/v1",
        "examples": len(examples),
        "scored_fields": total,
        "accuracy": (correct / total) if total else None,
        "per_field": {k: {**v, "accuracy": v["correct"] / v["total"]} for k, v in per_field.items()},
        "mismatches": confusion,
        "test_data_is_not_demand": True,
        "revenue_claim": False
    }

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--gold", default=str(Path(__file__).with_name("golden.jsonl")))
    parser.add_argument("--predictions", required=True, help="JSONL rows: id + prediction object")
    args = parser.parse_args()
    gold = [json.loads(line) for line in Path(args.gold).read_text(encoding="utf-8").splitlines() if line.strip()]
    preds = [json.loads(line) for line in Path(args.predictions).read_text(encoding="utf-8").splitlines() if line.strip()]
    report = evaluate(gold, preds)
    print(json.dumps(report, indent=2))
    if report["accuracy"] is None or report["accuracy"] < 0.90:
        raise SystemExit(1)
if __name__ == "__main__":
    main()
