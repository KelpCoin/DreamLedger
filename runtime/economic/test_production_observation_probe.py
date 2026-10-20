from production_observation_probe import inspect_action, inspect_payment


def test_internal_route_does_not_advance_authorized_to_executed():
    result = inspect_action({
        "opportunity_state": "AUTHORIZED",
        "dispatch_state": "INTERNAL_ROUTED",
        "authorization_verdict": "allow",
        "transition_context": {"worker_trace": True},
    })
    assert result["result"] == "EXACT_BLOCKER"
    assert result["error_class"] == "NO_TRANSITIONABLE_EVENT"
    assert result["dependency_state"] == "INTERNAL_ROUTED"
    assert result["missing_field"] == "external_action_sent_evidence"
    assert result["state_before"] == "AUTHORIZED"
    assert "state_after" not in result
    assert all(event["event_type"] != "ACTION_DISPATCHED" for event in result["events"])


def test_authorization_event_is_not_lost_after_an_inapplicable_early_event():
    result = inspect_action({
        "opportunity_state": "TRAVERSABLE",
        "status": "READY",
        "dispatch_state": "INTERNAL_ROUTED",
        "authorization_verdict": "allow",
        "transition_context": {"authorization_granted": True},
    })
    assert result["result"] == "NEXT_STATE"
    assert result["event_type"] == "ACTION_AUTHORIZED"
    assert result["state_before"] == "TRAVERSABLE"
    assert result["state_after"] == "AUTHORIZED"


def test_missing_production_state_is_exact_blocker():
    result = inspect_action({
        "dispatch_state": "INTERNAL_ROUTED",
        "authorization_verdict": "allow",
    })
    assert result["result"] == "EXACT_BLOCKER"
    assert result["missing_field"] == "opportunity_state"


def test_payment_remains_observation_until_settlement_evidence_is_joined():
    result = inspect_payment({"status": "processing"})
    assert result["events"] == [{"event_type": "PAYMENT_ATTEMPTED"}]
    assert "not revenue verification" in result["warning"]
