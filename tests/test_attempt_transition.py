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
