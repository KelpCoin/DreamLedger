#!/usr/bin/env python3
"""Validate the 777 long-horizon task graph using only the Python standard library.

This checks decomposition integrity and safety invariants. It does not execute jobs,
prove production enforcement, or establish economic demand/revenue.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GRAPH_PATH = ROOT / "webapp/agentic-commerce/777-long-horizon-task-contract-v1.json"

def require(condition, message):
    if not condition:
        raise ValueError(message)

def main():
    with GRAPH_PATH.open(encoding="utf-8") as handle:
        graph = json.load(handle)

    require(graph.get("schema") == "dreamledger/777-long-horizon-task-graph/v1",
            "task graph schema version mismatch")
    require(graph.get("status") == "EXECUTION_PLAN_NOT_REVENUE",
            "graph must not be represented as a completed commercial outcome")
    truth = graph.get("truth", {})
    require(truth.get("verified_external_revenue_nzd") == 0,
            "verified revenue must remain zero until independently evidenced")
    require(truth.get("green_ci_is_revenue") is False,
            "green CI must never be treated as revenue")
    policy = graph.get("execution_policy", {})
    require(policy.get("default_authority") == "READ_ONLY",
            "default authority must remain read-only")
    require(policy.get("budget_nzd_per_job") == 0,
            "default per-job budget must remain zero")
    require(policy.get("idempotency_required") is True,
            "idempotency must be mandatory")

    tasks = graph.get("task_graph")
    require(isinstance(tasks, list) and len(tasks) >= 8,
            "graph must contain a useful decomposed task set")
    by_id = {}
    for task in tasks:
        require(isinstance(task, dict), "each task must be an object")
        task_id = task.get("id")
        require(isinstance(task_id, str) and task_id, "task ID is required")
        require(task_id not in by_id, f"duplicate task ID: {task_id}")
        require(task.get("priority") in {"P0", "P1", "P2", "P3", "P4"},
                f"{task_id}: invalid priority")
        require(isinstance(task.get("objective"), str) and len(task["objective"]) >= 20,
                f"{task_id}: objective is missing or too short")
        require(isinstance(task.get("outputs"), list) and task["outputs"],
                f"{task_id}: at least one durable output is required")
        require(isinstance(task.get("acceptance"), list) and task["acceptance"],
                f"{task_id}: acceptance criteria are required")
        require(isinstance(task.get("depends_on"), list),
                f"{task_id}: dependencies must be a list")
        by_id[task_id] = task

    for task_id, task in by_id.items():
        for dependency in task["depends_on"]:
            require(dependency in by_id, f"{task_id}: unknown dependency {dependency}")

    visiting, visited = set(), set()
    def visit(task_id):
        require(task_id not in visiting, f"dependency cycle detected at {task_id}")
        if task_id in visited:
            return
        visiting.add(task_id)
        for dependency in by_id[task_id]["depends_on"]:
            visit(dependency)
        visiting.remove(task_id)
        visited.add(task_id)

    for task_id in by_id:
        visit(task_id)

    require(graph.get("current_next_task") in by_id,
            "current_next_task must point to a known task")
    require(graph["current_next_task"] == "DL777-01-ROUTE-PARITY",
            "P0 route parity remains the next task until fresh evidence supersedes it")
    print("777_LONG_HORIZON_TASK_GRAPH=PASS")
    print(f"TASK_COUNT={len(by_id)}")
    print("DEPENDENCIES=RESOLVED_AND_ACYCLIC")
    print("DEFAULT_AUTHORITY=READ_ONLY; DEFAULT_JOB_BUDGET_NZD=0")
    print("VERIFIED_EXTERNAL_REVENUE_NZD=0; ECONOMIC_PROOF=NOT_ESTABLISHED")

if __name__ == "__main__":
    main()
