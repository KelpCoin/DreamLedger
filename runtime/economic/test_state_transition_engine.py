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


def test_dispatch_cannot_prove_external_execution_even_with_worker_trace():
    t = transition_opportunity("AUTHORIZED", "ACTION_DISPATCHED", {"worker_trace": True})
    assert t.state_after is None
    assert t.error_class == "EXTERNAL_RESULT_REQUIRED"
    assert t.missing_field == "external_result_receipt_id"


def test_sent_is_not_observed():
    t = transition_opportunity("AUTHORIZED", "EXTERNAL_ACTION_SENT", {"worker_trace": True})
    assert t.state_after is None
    assert t.error_class == "EXTERNAL_RESULT_REQUIRED"


def test_observed_result_requires_upstream_authentication():
    t = transition_opportunity("AUTHORIZED", "EXTERNAL_RESULT_OBSERVED", {"external_result_receipt_id": "platform_123"})
    assert t.state_after is None
    assert t.error_class == "EXTERNAL_RESULT_UNVERIFIED"
    t = transition_opportunity("AUTHORIZED", "EXTERNAL_RESULT_OBSERVED", {
        "external_result_receipt_id": "platform_123", "external_result_verified": True})
    assert t.state_after == "EXECUTED"


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

# Existing GitHub Actions invokes "python3 test_state_transition_engine.py".
# Running a file of plain test_* functions does not execute those tests.
# This runner makes that existing CI job assertion-bearing without a new workflow.
if __name__ == "__main__":
    import inspect
    import importlib
    import unittest
    test_modules = [
        "test_state_transition_engine",
        "test_event_projection",
        "test_production_observation_probe",
        "test_stripe_observation_adapter",
    ]
    bare_executed = 0
    for name in test_modules:
        module = importlib.import_module(name)
        cases = [(n, f) for n, f in vars(module).items()
                 if n.startswith("test_") and inspect.isfunction(f)
                 and len(inspect.signature(f).parameters) == 0]
        if not cases:
            raise SystemExit("ECONOMIC_TEST_MODULE_EMPTY:" + name)
        for case_name, callback in sorted(cases):
            callback()
            bare_executed += 1
    suite = unittest.defaultTestLoader.loadTestsFromName("test_dispatch_provenance_unittest")
    result = unittest.TextTestRunner(verbosity=1).run(suite)
    if not result.wasSuccessful() or result.testsRun < 10 or bare_executed < 10:
        raise SystemExit("ECONOMIC_DISPATCH_TESTS_FAILED")
    print("ECONOMIC_DISPATCH_TESTS_EXECUTED", bare_executed, result.testsRun)
