#!/usr/bin/env python3
"""Minimal, append-only-in-practice economic compute trace envelope.

This module deliberately does not write economic truth. It records execution
resource observations so the existing economic machinery can consume them.
"""
import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

def now():
    return datetime.now(timezone.utc).isoformat()

def start_trace(action_id=None, opportunity_id=None, phase="EXECUTION"):
    return {
        "economic_trace_id": "ET-" + uuid.uuid4().hex,
        "action_id": action_id,
        "opportunity_id": opportunity_id,
        "phase": phase,
        "model_provider": os.environ.get("BEC_MODEL_PROVIDER") or "UNRECORDED",
        "model": os.environ.get("BEC_MODEL") or "UNRECORDED",
        "started_at": now(),
        "completed_at": None,
        "input_tokens": None,
        "output_tokens": None,
        "tool_call_count": 0,
        "estimated_provider_cost": None,
        "actual_provider_cost": None,
        "compute_cost_status": "UNKNOWN",
        "worker_resource_status": "AVAILABLE",
        "dependency_cut_set": [],
        "runtime_integrity": "UNKNOWN",
        "failure_class": None,
        "http_status": None,
        "resource_condition": None,
        "cost_source": None,
        "cost_status": "UNKNOWN",
    }

def observe_tool(trace):
    trace["tool_call_count"] = int(trace.get("tool_call_count") or 0) + 1

def finish_trace(trace, worker_resource_status=None, failure_class=None,
                 http_status=None, resource_condition=None):
    trace["completed_at"] = now()
    if worker_resource_status:
        trace["worker_resource_status"] = worker_resource_status
    trace["failure_class"] = failure_class
    trace["http_status"] = http_status
    trace["resource_condition"] = resource_condition
    return trace

def write_trace(trace, folder):
    path = Path(folder) / "economic_compute_trace.json"
    path.write_text(json.dumps(trace, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")
    return path
