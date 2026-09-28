from event_projection import project_action, project_payment, project_verification


def test_internal_route_is_not_external_send():
    events = project_action({
        "dispatch_state": "INTERNAL_ROUTED",
        "authorization_verdict": "allow",
    })
    kinds = {e["event_type"] for e in events}
    assert "ACTION_DISPATCHED" in kinds
    assert "EXTERNAL_ACTION_SENT" not in kinds


def test_external_sent_is_explicit():
    events = project_action({"dispatch_state": "EXTERNAL_SENT"})
    assert [e["event_type"] for e in events] == ["EXTERNAL_ACTION_SENT"]


def test_payment_settlement_requires_settled_status():
    assert project_payment({"status": "processing"}) == [{"event_type": "PAYMENT_ATTEMPTED"}]
    assert project_payment({"status": "succeeded"}) == [{"event_type": "PAYMENT_SETTLED"}]


def test_verified_outcome_requires_complete_predicate():
    assert project_verification(
        independent_buyer=True,
        settled_payment=True,
        fulfilled=True,
        evidence=True,
        predicate_passed=False,
    ) == []

    assert project_verification(
        independent_buyer=True,
        settled_payment=True,
        fulfilled=True,
        evidence=True,
        predicate_passed=True,
    ) == [{"event_type": "ECONOMIC_OUTCOME_VERIFIED"}]
