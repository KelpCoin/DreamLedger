from stripe_observation_adapter import project_stripe_payment


def test_processing_is_only_payment_attempted():
    result = project_stripe_payment({"status": "processing"})
    assert result["event_type"] == "PAYMENT_ATTEMPTED"
    assert result["settlement_supported"] is False


def test_succeeded_without_settlement_evidence_blocks():
    result = project_stripe_payment({
        "status": "succeeded",
        "independent_buyer": True,
    })
    assert result["result"] == "EXACT_BLOCKER"
    assert result["missing_field"] == "settlement_evidence"


def test_succeeded_with_settlement_and_independent_buyer_advances():
    result = project_stripe_payment({
        "status": "succeeded",
        "settlement_evidence": True,
        "independent_buyer": True,
    })
    assert result["result"] == "NEXT_STATE"
    assert result["event_type"] == "PAYMENT_SETTLED"
