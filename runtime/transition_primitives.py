"""Durable checkpoint and idempotency primitives for governed transitions."""
import hashlib
import json

def canonical_state_hash(snapshot: dict) -> str:
    payload = json.dumps(snapshot, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()

def checkpoint_id(transition_id: str, state_hash: str) -> str:
    return hashlib.sha256(f"{transition_id}|{state_hash}".encode("utf-8")).hexdigest()[:24]

def build_checkpoint(transition_id: str, snapshot: dict) -> dict:
    state_hash = canonical_state_hash(snapshot)
    return {
        "checkpoint_id": checkpoint_id(transition_id, state_hash),
        "transition_id": transition_id,
        "snapshot": snapshot,
        "state_hash": state_hash,
    }

def claim_idempotency(db, key: str, transition_id: str, outcome: str, response=None) -> dict:
    row = db.fetch_one(
        "select * from claim_transition_idempotency(%s,%s,%s,%s)",
        (key, transition_id, outcome, json.dumps(response) if response is not None else None),
    )
    if row["is_new"]:
        return {"is_new": True, "outcome": outcome, "response": response}
    return {"is_new": False, "outcome": row["prior_outcome"], "response": row["prior_response"]}
