#!/usr/bin/env python3
"""Deterministic safety checks for the Agent Bridge long-task schema and example.

Uses only Python's standard library. This is a contract/invariant check, not a
complete JSON Schema 2020-12 validator and not proof that a live worker enforces it.
"""
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
SCHEMA_PATH = ROOT / "webapp/agentic-commerce/agent-bridge-long-task-v1.schema.json"
EXAMPLE_PATH = ROOT / "webapp/agentic-commerce/agent-bridge-long-task-v1.example.json"

def require(condition, message):
    if not condition:
        raise ValueError(message)

def read_json(path):
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)

def walk(task, depth, parent_budget, ids, dedupe_keys, all_ids):
    require(isinstance(task, dict), "task must be an object")
    for key in ("task_id", "title", "objective", "status", "dedupe_key",
                "budget", "permissions", "approval_gates", "acceptance_criteria", "children"):
        require(key in task, f"task missing required field: {key}")
    require(task["task_id"] not in ids, f"duplicate task_id: {task['task_id']}")
    require(task["dedupe_key"] not in dedupe_keys, f"duplicate dedupe_key: {task['dedupe_key']}")
    ids.add(task["task_id"])
    dedupe_keys.add(task["dedupe_key"])
    all_ids.add(task["task_id"])

    budget = task["budget"]
    require(budget.get("currency") == "NZD", f"{task['task_id']}: currency must be NZD")
    caps = {"max_cost": 5, "max_calls": 100, "max_tokens": 50000,
            "timeout_seconds": 1800, "max_retries": 3, "max_parallelism": 2, "max_depth": 4}
    for key, cap in caps.items():
        value = budget.get(key)
        require(isinstance(value, (int, float)) and not isinstance(value, bool),
                f"{task['task_id']}: {key} must be numeric")
        require(value >= (1 if key in ("timeout_seconds", "max_parallelism") else 0),
                f"{task['task_id']}: {key} is below its minimum")
        require(value <= cap, f"{task['task_id']}: {key} exceeds hard cap {cap}")
    require(depth <= budget["max_depth"] or depth == 0,
            f"{task['task_id']}: nested depth exceeds its own max_depth")

    permissions = task["permissions"]
    require(permissions.get("external_spend_nzd") == 0, f"{task['task_id']}: external spend must be zero")
    require(permissions.get("public_publish") is False, f"{task['task_id']}: public publishing must be disabled")
    gpu = permissions.get("gpu", {})
    require(gpu.get("arbitrary_code") is False, f"{task['task_id']}: arbitrary GPU/host code must be disabled")
    require(gpu.get("max_vram_gb", 0) <= 8, f"{task['task_id']}: GPU memory cap exceeds 8 GB")
    require("payment" in task["approval_gates"], f"{task['task_id']}: payment approval gate is mandatory")
    require(isinstance(task["acceptance_criteria"], list) and task["acceptance_criteria"],
            f"{task['task_id']}: acceptance criteria must not be empty")

    children = task["children"]
    require(isinstance(children, list) and len(children) <= 25,
            f"{task['task_id']}: at most 25 child tasks are allowed")
    if children:
        require(depth < budget["max_depth"],
                f"{task['task_id']}: child tasks exceed max_depth")
        for field in ("max_cost", "max_calls", "max_tokens"):
            total = sum(child.get("budget", {}).get(field, 0) for child in children)
            require(total <= budget[field], f"{task['task_id']}: child {field} total exceeds parent budget")
        for child in children:
            walk(child, depth + 1, budget, ids, dedupe_keys, all_ids)

def main():
    schema = read_json(SCHEMA_PATH)
    example = read_json(EXAMPLE_PATH)
    require(schema.get("$schema") == "https://json-schema.org/draft/2020-12/schema",
            "schema must declare JSON Schema 2020-12")
    require(schema.get("properties", {}).get("schema", {}).get("const") ==
            "dreamledger.agent-bridge.long-task.v1", "schema version constant mismatch")
    require(schema.get("additionalProperties") is False, "unknown root fields must be rejected")
    require("budget" in schema.get("required", []), "budget must be required")
    require("permissions" in schema.get("required", []), "permissions must be required")
    require("children" in schema.get("required", []), "children must be required")
    require(example.get("schema") == "dreamledger.agent-bridge.long-task.v1",
            "example schema version mismatch")
    ids, dedupe_keys, all_ids = set(), set(), set()
    walk(example, 0, None, ids, dedupe_keys, all_ids)
    for task in flatten(example):
        for dependency in task.get("depends_on", []):
            require(dependency in all_ids, f"{task['task_id']}: unknown dependency {dependency}")
    require(len(example.get("children", [])) >= 2,
            "example must demonstrate decomposing a large task into bounded child tasks")
    print("AGENT_BRIDGE_LONG_TASK_CONTRACT=PASS")
    print(f"TASK_COUNT={len(ids)}")
    print("BUDGETS=bounded; child ceilings fit within parent; external spend=NZD 0")
    print("PERMISSIONS=public publishing disabled; arbitrary GPU/host code disabled")
    print("SCOPE=deterministic contract invariants only; live worker enforcement remains UNVERIFIED")

def flatten(task):
    yield task
    for child in task.get("children", []):
        yield from flatten(child)

if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"AGENT_BRIDGE_LONG_TASK_CONTRACT=FAIL: {exc}", file=sys.stderr)
        sys.exit(1)
