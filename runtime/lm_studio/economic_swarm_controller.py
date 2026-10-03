import json, os, sys, time, urllib.request, urllib.parse
from datetime import datetime, timezone

BASE = os.environ.get("LM_STUDIO_BASE_URL", "http://127.0.0.1:12340").rstrip("/")
INTERVAL = int(os.environ.get("DREAMLEDGER_SWARM_INTERVAL_SECONDS", "60"))
ROUNDS = max(2, int(os.environ.get("DREAMLEDGER_REFINEMENT_ROUNDS", "5")))
ROOT = os.environ.get("DREAMLEDGER_ROOT") or os.getcwd()
RUNS = os.path.join(ROOT, "runtime", "lm_studio", "runs")
os.makedirs(RUNS, exist_ok=True)

ROLE_ENV = {
    "SCOUT": "DREAMLEDGER_SCOUT_MODEL",
    "ANALYST": "DREAMLEDGER_ANALYST_MODEL",
    "BUILDER": "DREAMLEDGER_BUILDER_MODEL",
    "CRITIC": "DREAMLEDGER_LM_MODEL_CRITIC",
    "GAUNTLET": "DREAMLEDGER_GAUNTLET_MODEL",
    "SYNTHESIS": "DREAMLEDGER_SYNTHESIS_MODEL",
}

ROLE_DEFAULTS = {
    "SCOUT": ("DREAMLEDGER_LM_MODEL_CREATIVE", "qwen2.5-7b-instruct"),
    "ANALYST": ("DREAMLEDGER_ANALYST_MODEL", "openai/gpt-oss-20b"),
    "BUILDER": ("DREAMLEDGER_LM_MODEL_CREATIVE", "qwen2.5-coder-14b-instruct"),
    "CRITIC": ("DREAMLEDGER_LM_MODEL_CRITIC", "local"),
    "GAUNTLET": ("DREAMLEDGER_LM_MODEL_CRITIC", "local"),
    "SYNTHESIS": ("DREAMLEDGER_LM_MODEL_CREATIVE", "qwen2.5-7b-instruct"),
}

SYSTEM = {
    "SCOUT": "Find and refresh externally observable opportunities using only supplied evidence. Expand possibilities without inventing facts.",
    "ANALYST": "Qualify evidence, economics, traversability, freshness, capability and constraints. Separate facts from assumptions.",
    "BUILDER": "Construct the smallest useful internal artifact, implementation step or preparation packet. Never perform external action.",
    "CRITIC": "Try to falsify the current packet. Hunt contradictions, stale evidence, hidden dependencies and unsupported claims.",
    "GAUNTLET": "Act as an adversarial authority and safety gate. Reject unsupported, unauthorized, irreversible or prohibited external actions.",
    "SYNTHESIS": "Reconcile the panel into the strongest evidence-backed next state. Preserve blockers and uncertainty. Never override a Gauntlet prohibition."
}

CONSTRAINTS = [
    "no self purchase",
    "no simulated revenue",
    "no fake buyers",
    "no autonomous outreach or proposal submission",
    "no autonomous spending",
    "no credential or secret handling",
    "no platform bypass",
    "human gate for irreversible external action",
    "UNKNOWN remains UNKNOWN",
    "consensus is not truth",
    "confidence is not evidence"
]

def api(path, body=None, timeout=120):
    data = None if body is None else json.dumps(body, separators=(",", ":")).encode("utf-8")
    headers = {"Accept": "application/json"}
    if body is not None:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(
        BASE + path,
        data=data,
        headers=headers,
        method="POST" if body is not None else "GET",
    )
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))

def get_models():
    data = api("/v1/models", timeout=15).get("data", [])
    return [str(x.get("id")) for x in data if x.get("id")]

def snapshot():
    packet = {
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        "mode": "MULTI_LLM_ITERATIVE_REFINEMENT",
        "economic_truth": {
            "verified_external_revenue_nzd": 0,
            "settled_external_payments": 0,
            "independent_external_buyers": 0
        },
        "constraints": CONSTRAINTS,
        "surfaces": ["CUBE", "SWARM", "ELOHIM", "GAUNTLET", "TRUTH_ORACLE", "DREAMLEDGER"],
    }

    latest_777 = os.path.join(ROOT, "BEC-PRIME", "data", "777", "777-LATEST.json")
    if os.path.exists(latest_777):
        try:
            with open(latest_777, "r", encoding="utf-8") as f:
                latest = json.load(f)
            packet["777"] = {
                "buyer_signal_queue": latest.get("buyer_signal_queue", [])[:10],
                "next_human_action": latest.get("next_human_action"),
                "evergreen_expansion": latest.get("evergreen_expansion", {}),
                "truth": latest.get("truth", {}),
            }
        except Exception as exc:
            packet["777_error"] = str(exc)

    supa = os.environ.get("SUPABASE_URL", "").rstrip("/")
    key = os.environ.get("SUPABASE_ANON_KEY", "")
    if supa and key:
        try:
            q = urllib.parse.urlencode({
                "select": "opportunity_id,source,subject,status,expected_value_nzd,expected_cost_nzd,time_budget_minutes,authority_lane,observed_at",
                "order": "expected_value_nzd.desc.nullslast",
                "limit": "50"
            })
            packet["opportunities"] = api.__wrapped__ if False else None
            req = urllib.request.Request(
                supa + "/rest/v1/cube_opportunities?" + q,
                headers={"Accept": "application/json", "apikey": key, "Authorization": "Bearer " + key},
            )
            with urllib.request.urlopen(req, timeout=20) as r:
                packet["opportunities"] = json.loads(r.read().decode("utf-8"))
        except Exception as exc:
            packet["opportunities_error"] = str(exc)
    return packet

def call(role, model, packet):
    schema = {
        "type": "json_schema",
        "json_schema": {
            "name": "dreamledger_refinement_stage",
            "strict": True,
            "schema": {
                "type": "object",
                "properties": {
                    "role": {"type": "string"},
                    "result": {"type": "string"},
                    "changes": {"type": "array", "items": {"type": "string"}},
                    "blockers": {"type": "array", "items": {"type": "string"}},
                    "evidence_refs": {"type": "array", "items": {"type": "string"}},
                    "human_gate": {"type": "boolean"},
                    "next_action": {"type": "string"},
                    "material_change": {"type": "boolean"}
                },
                "required": [
                    "role", "result", "changes", "blockers",
                    "evidence_refs", "human_gate", "next_action", "material_change"
                ],
                "additionalProperties": False
            }
        }
    }

    body = {
        "model": model,
        "messages": [
            {
                "role": "system",
                "content": (
                    SYSTEM[role]
                    + " Never invent buyers, payments, revenue, credentials, evidence or external outcomes."
                    + " Preserve earlier blockers unless new evidence explicitly resolves them."
                    + " Any irreversible external action requires human_gate=true."
                    + " The response must be grounded only in the supplied packet."
                )
            },
            {
                "role": "user",
                "content": json.dumps({"role": role, "packet": packet}, separators=(",", ":"))
            }
        ],
        "response_format": schema,
        "temperature": 0.1,
        "stream": False
    }

    response = api("/v1/chat/completions", body, timeout=180)
    content = response["choices"][0]["message"]["content"]
    return json.loads(content)

def choose_models(available):
    assignments = {}
    for role in ROLE_ENV:
        configured = os.environ.get(ROLE_ENV[role], "").strip()
        aliases = ROLE_DEFAULTS.get(role, ("", ""))
        alias_env, fallback = aliases
        candidate = configured or (os.environ.get(alias_env, "").strip() if alias_env else "") or fallback

        if candidate == "local" and "local" in available:
            assignments[role] = "local"
            continue

        if candidate in available:
            assignments[role] = candidate
            continue

        fuzzy = [m for m in available if candidate and candidate.lower() in m.lower()]
        if fuzzy:
            assignments[role] = fuzzy[0]
            continue

        if role == "CRITIC" and "local" in available:
            assignments[role] = "local"
            continue

        if available:
            assignments[role] = available[0]
            continue

        raise RuntimeError("MODEL_UNAVAILABLE:" + role)

    return assignments

def cycle():
    available = get_models()
    if not available:
        return {"status": "BLOCKED", "reason": "NO_LM_STUDIO_MODELS"}

    assignments = choose_models(available)
    packet = snapshot()
    history = []
    previous_signature = None
    converged = False

    for round_no in range(1, ROUNDS + 1):
        packet["round"] = round_no
        panel = []

        for role in ["SCOUT", "ANALYST", "BUILDER", "CRITIC", "GAUNTLET", "SYNTHESIS"]:
            out = call(role, assignments[role], packet)
            out["model"] = assignments[role]
            panel.append(out)

            # Earlier blockers stay in the packet and remain visible downstream.
            packet.setdefault("panel", [])
            packet["panel"] = panel

        gauntlet = next((x for x in panel if x.get("role") == "GAUNTLET"), {})
        synthesis = next((x for x in panel if x.get("role") == "SYNTHESIS"), {})

        if gauntlet.get("human_gate") or synthesis.get("human_gate"):
            packet["human_gate"] = True

        packet["accepted_panel"] = panel
        signature = json.dumps(
            [
                {
                    "role": x.get("role"),
                    "result": x.get("result"),
                    "changes": x.get("changes"),
                    "blockers": x.get("blockers"),
                    "next_action": x.get("next_action"),
                    "human_gate": x.get("human_gate"),
                    "material_change": x.get("material_change"),
                }
                for x in panel
            ],
            sort_keys=True
        )
        history.append({"round": round_no, "stages": panel})

        if signature == previous_signature:
            converged = True
            break
        previous_signature = signature

        # The synthesis becomes the next packet instead of resetting to round zero.
        packet["previous_synthesis"] = synthesis

    result = {
        "status": "READY",
        "mode": "MULTI_LLM_ITERATIVE_REFINEMENT",
        "base_url": BASE,
        "assignments": assignments,
        "available_models": available,
        "rounds": len(history),
        "configured_max_rounds": ROUNDS,
        "converged": converged,
        "panel_history": history,
        "final": history[-1] if history else None,
        "human_gate": bool(packet.get("human_gate", False)),
        "timestamp_utc": datetime.now(timezone.utc).isoformat()
    }

    fn = os.path.join(
        RUNS,
        "multi-llm-" + datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ") + ".json"
    )
    with open(fn, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2)

    result["run_file"] = fn
    return result

def main():
    once = "--once" in sys.argv
    while True:
        try:
            print(json.dumps(cycle(), indent=2), flush=True)
        except Exception as exc:
            print(json.dumps({
                "status": "BLOCKED",
                "reason": "REFINEMENT_CYCLE_FAILED",
                "error": str(exc)
            }, indent=2), flush=True)
        if once:
            break
        time.sleep(INTERVAL)

if __name__ == "__main__":
    main()
