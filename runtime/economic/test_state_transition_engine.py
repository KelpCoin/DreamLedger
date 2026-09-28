from state_transition_engine import transition_opportunity


def test_valid_path_advances_without_skip():
    t = transition_opportunity(
        "DISCOVERED", "DEMAND_QUALIFIED",
        {"legitimacy_ok": True, "jurisdiction_ok": True},
    )
    assert t.state_after == "QUALIFIED"


def test_missing_authority_blocks_exactly():
    t = transition_opportunity(
        "CAPABILITY_MATCHED", "TRAVERSABLE",
        {
            "access_confirmed": True,
            "authority_confirmed": False,
            "validation_ready": True,
            "settlement_path_confirmed": True,
            "delivery_path_confirmed": True,
        },
    )
    assert t.state_after is None
    assert t.error_class == "AUTHORITY_FAILURE"
    assert t.missing_field == "authority_confirmed"


def test_dispatch_requires_worker_trace():
    t = transition_opportunity("AUTHORIZED", "ACTION_DISPATCHED", {})
    assert t.state_after is None
    assert t.missing_field == "worker_trace"


def test_payment_does_not_advance_without_buyer_and_settlement():
    t = transition_opportunity(
        "EXECUTED", "PAYMENT_SETTLED",
        {"independent_buyer": True, "settlement_evidence": False},
    )
    assert t.state_after is None
    assert t.error_class == "SETTLEMENT_FAILURE"
    assert t.missing_field == "settlement_evidence"


def test_verified_requires_full_join():
    t = transition_opportunity(
        "FULFILLED", "ECONOMIC_OUTCOME_VERIFIED",
        {
            "payment_settled": True,
            "fulfillment_complete": True,
            "evidence_joined": False,
            "verification_passed": True,
        },
    )
    assert t.state_after is None
    assert t.missing_field == "evidence_joined"
