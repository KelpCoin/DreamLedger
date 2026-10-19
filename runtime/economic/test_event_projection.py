from event_projection import project_action, project_payment, project_verification
from state_transition_engine import transition_opportunity


def test_internal_route_is_not_external_send_or_action_dispatch():
    events = project_action({
        "dispatch_state": "INTERNAL_ROUTED",
        "authorization_verdict": "allow",
    })
    kinds = {event["event_type"] for event in events}
    assert "ACTION_AUTHORIZED" in kinds
    assert "ACTION_DISPATCHED" not in kinds
    assert "EXTERNAL_ACTION_SENT" not in kinds


def test_external_sent_is_explicit():
    events = project_action({"dispatch_state": "EXTERNAL_SENT"})
    assert [event["event_type"] for event in events] == ["EXTERNAL_ACTION_SENT"]


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


def _replay_projected_event_log(rows, initial_state):
    """Replay observed persisted rows through the canonical projection and FSM."""
    state = initial_state
    states = [state]
    blockers = []

    for row in rows:
        for candidate in project_action(row):
            decision = transition_opportunity(
                state,
                candidate["event_type"],
                row.get("transition_context") or {},
            )
            if decision.state_after:
                state = decision.state_after
                states.append(state)
            elif decision.error_class == "STATE_TRANSITION_INVALID":
                continue
            elif decision.error_class:
                blockers.append({
                    "event_type": candidate["event_type"],
                    "error_class": decision.error_class,
                    "dependency_state": decision.dependency_state,
                    "missing_field": decision.missing_field,
                })

    return {"state": state, "states": states, "blockers": blockers}


def test_full_projection_replay_never_counts_internal_route_as_executed():
    # Regression event log: authorization was observed; dispatch was only internal.
    # This is a deterministic test fixture, not a claimed production database row.
    event_log = [
        {
            "event_id": "test-auth-001",
            "action_type": "EXTERNAL_ACTION",
            "opportunity_state": "TRAVERSABLE",
            "status": "READY",
            "authorization_verdict": "allow",
            "dispatch_state": "NOT_DISPATCHED",
            "transition_context": {"authorization_granted": True},
        },
        {
            "event_id": "test-route-002",
            "action_type": "EXTERNAL_ACTION",
            "opportunity_state": "AUTHORIZED",
            "status": "DISPATCHED",
            "authorization_verdict": "allow",
            "dispatch_state": "INTERNAL_ROUTED",
            "transition_context": {"authorization_granted": True, "worker_trace": True},
        },
    ]

    replay = _replay_projected_event_log(event_log, "TRAVERSABLE")

    assert replay["state"] == "AUTHORIZED"
    assert "EXECUTED" not in replay["states"]
    assert "ACTION_DISPATCHED" not in {
        candidate["event_type"]
        for row in event_log
        for candidate in project_action(row)
    }
