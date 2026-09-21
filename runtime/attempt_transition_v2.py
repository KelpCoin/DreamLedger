"""Atomic governed transition executor. No LLM is consulted in the decision path."""
import hashlib
import json
from datetime import datetime, timezone

def transition_id(offer_id: str, from_state: str, to_state: str) -> str:
    return hashlib.sha256(f"{offer_id}|{from_state}|{to_state}".encode()).hexdigest()[:24]

def evaluate_preconditions(policy: dict, offer: dict):
    failures = []
    for check in policy["deterministic_preconditions"]:
        field = check["field"]
        if check.get("required") and not offer.get(field):
            failures.append(field)
    return not failures, failures

async def attempt_transition(db, offer_id: str, policy: dict, idempotency_key: str):
    async with db.transaction():
        tid = transition_id(offer_id, policy["from_state"], policy["to_state"])
        existing = await db.fetchrow(
            "select outcome, transition_id from public.economic_transitions where idempotency_key = $1 or transition_id = $2 limit 1",
            idempotency_key, tid)
        if existing:
            return {"outcome": existing["outcome"], "transition_id": existing["transition_id"], "replay": True}

        offer = await db.fetchrow(
            "select *, lifecycle_status as state from public.offers where id = $1 for update", offer_id)
        if not offer:
            return {"outcome": "REJECTED", "reason": {"code": "OFFER_NOT_FOUND"}, "replay": False}

        passed, failures = evaluate_preconditions(policy, dict(offer))
        if not passed:
            outcome, reason = "REJECTED", {"failed_preconditions": failures}
        elif policy.get("authority_lane") == "AMBER":
            outcome, reason = "AWAITING_AUTHORIZATION", {"authority_lane": "AMBER"}
        else:
            outcome, reason = "APPROVED", None

        await db.execute(
            """insert into public.economic_transitions
               (transition_id, offer_id, from_state, to_state, outcome, reason, idempotency_key, created_at)
               values ($1,$2,$3,$4,$5,$6,$7,$8)
               on conflict (transition_id) do nothing""",
            tid, offer_id, policy["from_state"], policy["to_state"], outcome,
            json.dumps(reason) if reason else None, idempotency_key, datetime.now(timezone.utc))

        if outcome == "APPROVED":
            result = await db.fetchrow(
                """update public.offers set lifecycle_status=$1, version=version+1, updated_at=now()
                   where id=$2 and version=$3 and lifecycle_status=$4 returning id,version""",
                policy["to_state"], offer_id, offer["version"], policy["from_state"])
            if not result:
                raise RuntimeError("CONCURRENT_STATE_CHANGE")

        return {"outcome": outcome, "transition_id": tid, "replay": False}
