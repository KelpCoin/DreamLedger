"""Governed transition executor. Deterministic. No LLM in the decision path."""
import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path

import yaml

POLICY_PATH = Path(os.getenv("POLICY_PATH", "ops/policy/transitions.yaml"))

def load_policy():
    with open(POLICY_PATH) as f:
        return yaml.safe_load(f)

def transition_id(offer_id: str, from_state: str, to_state: str) -> str:
    raw = f"{offer_id}|{from_state}|{to_state}"
    return hashlib.sha256(raw.encode()).hexdigest()[:24]

def idempotency_key(transition_id: str) -> str:
    return f"dl-transition-{transition_id}"

def evaluate_preconditions(policy: dict, offer: dict) -> tuple[bool, list[str]]:
    failures = []
    for check in policy["deterministic_preconditions"]:
        field = check["field"]
        if check.get("required") and not offer.get(field):
            failures.append(field)
    return (len(failures) == 0, failures)

def attempt_transition(offer: dict, policy_name: str, db) -> dict:
    policy = load_policy()["transitions"][policy_name]
    tid = transition_id(offer["id"], policy["from_state"], policy["to_state"])
    existing = db.fetch_one(
        "select outcome from economic_transitions where transition_id = %s", (tid,)
    )
    if existing:
        return {"outcome": "ALREADY_EXECUTED", "transition_id": tid, "prior": existing["outcome"]}
    passed, failures = evaluate_preconditions(policy, offer)
    if not passed:
        db.execute(
            """insert into economic_transitions
               (transition_id, offer_id, from_state, to_state, outcome, reason, created_at)
               values (%s, %s, %s, %s, 'REJECTED', %s, %s)""",
            (tid, offer["id"], policy["from_state"], policy["to_state"],
             json.dumps({"failed_preconditions": failures}), datetime.now(timezone.utc)),
        )
        return {"outcome": "REJECTED", "transition_id": tid, "failed": failures}
    if policy["authority_lane"] == "AMBER":
        db.execute(
            """insert into economic_transitions
               (transition_id, offer_id, from_state, to_state, outcome, created_at)
               values (%s, %s, %s, %s, 'AWAITING_AUTHORIZATION', %s)""",
            (tid, offer["id"], policy["from_state"], policy["to_state"],
             datetime.now(timezone.utc)),
        )
        return {"outcome": "AWAITING_AUTHORIZATION", "transition_id": tid}
    return {"outcome": "APPROVED", "transition_id": tid}
