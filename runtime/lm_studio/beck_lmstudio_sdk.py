"""Official LM Studio Python SDK adapter for BECK/CORTEX.

Inference is local-only by deployment convention. Model output is advisory and must pass
the existing schema checks and Gauntlet. This module performs no external actions.
"""
from __future__ import annotations

import json
import os
import time
from typing import Any

FIELDS = [
    "1_PAIN", "2_FREQUENCY", "3_URGENCY", "4_CURRENT_WORKAROUND",
    "5_BUYING_INTENT", "6_MONEY_SIGNAL", "7_BUYER",
    "8_PRODUCT_OPPORTUNITY", "9_STATUS_BUCKET", "10_NEXT_ACTION",
]
ALLOWED = {
    "2_FREQUENCY": {"isolated", "recurring", "widespread"},
    "3_URGENCY": {"nuisance", "costly", "blocking", "critical"},
    "5_BUYING_INTENT": {"none", "implied", "stated", "actively_seeking", "already_paying"},
    "6_MONEY_SIGNAL": {"explicit_budget", "existing_spend", "avoided_loss", "unknown"},
    "9_STATUS_BUCKET": {"WORKING_MONETIZABLE", "TRENDING_SPIKE", "DEAD_ABANDONED", "HUMAN_GATE_CANDIDATE"},
    "10_NEXT_ACTION": {"ignore", "monitor", "investigate", "free_diagnostic", "paid_offer_candidate", "cube_swarm_candidate"},
}

def _schema() -> dict[str, Any]:
    props: dict[str, Any] = {}
    for field in FIELDS:
        props[field] = {"type": "string"}
        if field in ALLOWED:
            props[field]["enum"] = sorted(ALLOWED[field])
    return {"type": "object", "properties": props, "required": FIELDS, "additionalProperties": False}

def _sdk():
    try:
        import lmstudio as lms
    except ImportError as exc:
        raise RuntimeError("LMSTUDIO_PYTHON_SDK_NOT_INSTALLED") from exc
    host = os.environ.get("LM_STUDIO_SDK_HOST", "").strip()
    if host:
        # Must be configured before the first default-client interaction.
        lms.configure_default_client(host)
    return lms

def classify_with_sdk(prompt: str, model_key: str = "") -> tuple[dict[str, Any], dict[str, Any]]:
    """Run one structured, metered SDK prediction; missing telemetry stays null."""
    lms = _sdk()
    started = time.perf_counter()
    model = lms.llm(model_key) if model_key else lms.llm()
    prediction = model.respond(
        prompt,
        config={"temperature": 0.1, "maxTokens": 1200},
        response_format=_schema(),
    )
    elapsed_ms = round((time.perf_counter() - started) * 1000, 2)
    parsed = getattr(prediction, "parsed", None)
    if isinstance(parsed, str):
        parsed = json.loads(parsed)
    if not isinstance(parsed, dict):
        raise ValueError("LMSTUDIO_SDK_STRUCTURED_RESPONSE_MISSING")
    for field in FIELDS:
        if field not in parsed:
            raise ValueError("MISSING_" + field)
        if field in ALLOWED and parsed[field] not in ALLOWED[field]:
            raise ValueError("INVALID_" + field)
    stats = getattr(prediction, "stats", None)
    model_info = getattr(prediction, "model_info", None)
    telemetry = {
        "provider": "lmstudio-python-sdk",
        "model": str(getattr(model_info, "display_name", None) or model_key or os.environ.get("LM_STUDIO_MODEL") or "default"),
        "fallback": False,
        "latency_ms": elapsed_ms,
        "input_tokens": getattr(stats, "prompt_tokens_count", None) if stats else None,
        "output_tokens": getattr(stats, "predicted_tokens_count", None) if stats else None,
        "time_to_first_token_sec": getattr(stats, "time_to_first_token_sec", None) if stats else None,
        "estimated_cost": None,
        "cost_currency": None,
        "task_class": "demand_signal_classification",
    }
    return parsed, telemetry

def search_local_signal_fixtures(query: str) -> list:
    """Search only the repository's fixed local signal fixtures; never accesses the web."""
    from pathlib import Path
    root = Path(__file__).resolve().parents[2]
    fixtures = root / "runtime" / "lm_studio" / "fixtures"
    needle = str(query or "").strip().lower()
    if not needle or not fixtures.is_dir():
        return []
    results = []
    for path in sorted(fixtures.glob("*.json")):
        try:
            row = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            continue
        if needle in json.dumps(row, ensure_ascii=False).lower():
            results.append({"fixture": path.name, "signal": row})
    return results[:10]

def summarize_local_signal_counts() -> dict[str, Any]:
    """Summarize local run artifacts only; counts are not demand or revenue."""
    from pathlib import Path
    root = Path(__file__).resolve().parents[2]
    runs = root / "runtime" / "lm_studio" / "runs"
    files = list(runs.glob("signal-*.json")) if runs.is_dir() else []
    return {"local_run_artifacts": len(files), "external_actions": 0, "revenue_claim": False}

def preview_classification(text: str) -> dict[str, Any]:
    """Return a deliberately provisional lexical preview; not a Gauntlet decision."""
    value = str(text or "").lower()
    budget = any(token in value for token in ("budget", "paying", "invoice", "spend", "$", "quote"))
    urgency = any(token in value for token in ("urgent", "asap", "critical", "blocked", "deadline"))
    repeated = any(token in value for token in ("weekly", "monthly", "every week", "every day", "hours a week"))
    return {
        "money_signal_hint": "possible" if budget else "unknown",
        "urgency_hint": "possible" if urgency else "unknown",
        "frequency_hint": "recurring_candidate" if repeated else "unknown",
        "authoritative": False,
        "revenue_claim": False
    }

def cortex_act(task: str, tools: list | None = None, model_key: str = "", max_tool_calls: int = 3, max_rounds: int = 4):
    """Bounded local agent loop. Only caller-supplied, pre-approved tools are exposed.

    Each exposed function must be read-only and local. The wrapper counts actual tool
    invocations; it intentionally offers no shell, arbitrary file write, network, payment,
    public-posting, or authoritative-ledger mutation capability.
    """
    if not isinstance(task, str) or not task.strip():
        raise ValueError("CORTEX_TASK_REQUIRED")
    if not isinstance(max_tool_calls, int) or not 1 <= max_tool_calls <= 5:
        raise ValueError("MAX_TOOL_CALLS_MUST_BE_1_TO_5")
    allowed_names = {"search_local_signal_fixtures", "summarize_local_signal_counts", "preview_classification"}
    if not isinstance(max_rounds, int) or not 1 <= max_rounds <= 5:
        raise ValueError("MAX_ROUNDS_MUST_BE_1_TO_5")
    if tools is None:
        tools = [search_local_signal_fixtures, summarize_local_signal_counts, preview_classification]
    if not isinstance(tools, list) or not tools:
        raise ValueError("EXPLICIT_SAFE_TOOLS_REQUIRED")
    wrapped = []
    budget = {"calls": 0}
    for tool in tools:
        name = getattr(tool, "__name__", "")
        if name not in allowed_names:
            raise ValueError("TOOL_NOT_ALLOWLISTED:" + name)
        def bounded(*args, __tool=tool, __name=name, **kwargs):
            budget["calls"] += 1
            if budget["calls"] > max_tool_calls:
                raise RuntimeError("CORTEX_ACT_TOOL_BUDGET_EXCEEDED")
            return __tool(*args, **kwargs)
        bounded.__name__ = name
        bounded.__doc__ = getattr(tool, "__doc__", "") or "Approved read-only local Cortex tool."
        wrapped.append(bounded)
    lms = _sdk()
    model = lms.llm(model_key) if model_key else lms.llm()
    def enforce_round_budget(round_index):
        if int(round_index) >= max_rounds:
            raise RuntimeError("CORTEX_ACT_ROUND_BUDGET_EXCEEDED")
    started = time.perf_counter()
    result = model.act(task, wrapped, max_parallel_tool_calls=1, on_round_start=enforce_round_budget)
    return {
        "result": str(result), "tool_calls": budget["calls"], "tool_call_budget": max_tool_calls,
        "round_budget": max_rounds, "latency_ms": round((time.perf_counter() - started) * 1000, 2),
        "model": model_key or os.environ.get("LM_STUDIO_MODEL") or "default",
        "external_action_taken": False, "revenue_claim": False
    }
