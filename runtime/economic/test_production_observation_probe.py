from production_observation_probe import inspect_action, inspect_payment


def test_internal_route_must_not_advance_to_external_execution():
    result = inspect_action({
        "opportunity_state": "AUTHORIZED",
        "dispatch_state": "INTERNAL_ROUTED",
        "authorization_verdict": "allow",
        "transition_context": {"worker_trace": True},
    })
    assert result["result"] == "EXACT_BLOCKER"
    assert result["error_class"] == "EXTERNAL_RESULT_REQUIRED"
    assert result["missing_field"] == "external_result_receipt_id"


def test_external_sent_must_not_advance_to_external_execution():
    result = inspect_action({
        "opportunity_state": "AUTHORIZED",
        "dispatch_state": "EXTERNAL_SENT",
        "authorization_verdict": "allow",
        "transition_context": {"worker_trace": True},
    })
    assert result["result"] == "EXACT_BLOCKER"
    assert result["error_class"] == "EXTERNAL_RESULT_REQUIRED"


def test_authenticated_external_result_can_advance_from_authorized():
    result = inspect_action({
        "opportunity_state": "AUTHORIZED",
        "dispatch_state": "EXTERNAL_RESULT_OBSERVED",
        "authorization_verdict": "allow",
        "transition_context": {
            "external_result_receipt_id": "platform_receipt_123",
            "external_result_verified": True,
        },
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
