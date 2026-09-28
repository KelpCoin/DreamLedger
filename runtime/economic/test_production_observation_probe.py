from production_observation_probe import inspect_action, inspect_payment


def test_real_row_shape_can_only_advance_with_transition_context():
    result = inspect_action({
        "opportunity_state": "AUTHORIZED",
        "dispatch_state": "INTERNAL_ROUTED",
        "authorization_verdict": "allow",
        "transition_context": {"worker_trace": True},
    })
    assert result["result"] == "NEXT_STATE"
    assert result["state_after"] == "EXECUTED"


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
