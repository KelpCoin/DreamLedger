import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from runtime.attempt_transition import transition_id, idempotency_key, evaluate_preconditions, load_policy

def test_transition_id_is_deterministic():
    assert transition_id("offer-1", "OFFER_READY", "OFFER_PUBLISHED") == transition_id("offer-1", "OFFER_READY", "OFFER_PUBLISHED")

def test_transition_id_changes_on_state_change():
    assert transition_id("offer-1", "OFFER_READY", "OFFER_PUBLISHED") != transition_id("offer-1", "OFFER_READY", "OFFER_PAUSED")

def test_idempotency_key_format():
    k = idempotency_key("abc123")
    assert k.startswith("dl-transition-") and "abc123" in k

def test_preconditions_reject_missing_price():
    policy = load_policy()["transitions"]["OFFER_READY__OFFER_PUBLISHED"]
    offer = {check["field"]: True for check in policy["deterministic_preconditions"]}
    offer.update({"id":"offer-1","price_present":False})
    passed, failures = evaluate_preconditions(policy, offer)
    assert not passed and "price_present" in failures

def test_preconditions_pass_when_complete():
    policy = load_policy()["transitions"]["OFFER_READY__OFFER_PUBLISHED"]
    offer = {check["field"]: True for check in policy["deterministic_preconditions"]}
    offer["id"] = "offer-1"
    assert evaluate_preconditions(policy, offer) == (True, [])


class FakeDB:
    def __init__(self):
        self.rows = {}
        self.inserts = []
    def fetch_one(self, _sql, params):
        return self.rows.get(params[0])
    def execute(self, _sql, params):
        tid = params[0]
        self.rows[tid] = {"outcome": params[4] if len(params) > 4 else "UNKNOWN"}
        self.inserts.append(params)

def test_attempt_transition_enters_amber_once():
    from runtime.attempt_transition import attempt_transition
    policy = load_policy()["transitions"]["OFFER_READY__OFFER_PUBLISHED"]
    offer = {check["field"]: True for check in policy["deterministic_preconditions"]}
    offer["id"] = "offer-amber"
    db = FakeDB()
    first = attempt_transition(offer, "OFFER_READY__OFFER_PUBLISHED", db)
    second = attempt_transition(offer, "OFFER_READY__OFFER_PUBLISHED", db)
    assert first["outcome"] == "AWAITING_AUTHORIZATION"
    assert second["outcome"] == "ALREADY_EXECUTED"
