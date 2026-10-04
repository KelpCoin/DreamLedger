import pytest
from runtime.authorization_firewall import AuthorizationFirewall
from runtime.autonomy_budget import evaluate_window
from runtime.event_envelope import EventEnvelope

def test_unknown_action_is_default_deny():
    fw = AuthorizationFirewall()
    result = fw.authorize({"action":"not-a-real-action","principal":"cortex","scope":[]})
    assert result["verdict"] == "DENY"

def test_amber_publication_requires_approval():
    fw = AuthorizationFirewall()
    result = fw.authorize({"action":"publish_offer","principal":"cortex","scope":["offer:publish"]})
    assert result["verdict"] == "REQUIRE_APPROVAL"

def test_missing_external_metric_demotes():
    result = evaluate_window({}, {"verified_outcome_rate":0.9}, "AUTONOMOUS", "AUTONOMOUS")
    assert result["action"] == "DEMOTE"

def test_event_retries_share_transition_idempotency_key():
    a = EventEnvelope("e1","TOOL_CALL_REQUESTED","1.0","t1","dl-event-t1","cortex","2026-09-22T00:00:00+00:00",{})
    b = EventEnvelope("e2","TOOL_CALL_REQUESTED","1.0","t1","dl-event-t1","cortex","2026-09-22T00:00:01+00:00",{})
    assert a.idempotency_key == b.idempotency_key
