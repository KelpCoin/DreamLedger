from pathlib import Path
import json

from saas_leakage_cell import reconcile

FIXTURE = Path(__file__).parents[2] / "fixtures" / "saas_inventory_fixture.json"


def test_fixture_reconciliation_is_fail_closed():
    result = reconcile(FIXTURE)
    assert result["fixture_status"] == "SYNTHETIC_OFFLINE_TEST_ONLY"
    assert result["mismatch_metrics"]["inactive_candidate_count"] == 4
    assert result["mismatch_metrics"]["inactive_candidate_user_ids"] == [
        "uid_002", "uid_003", "uid_004", "uid_005"
    ]
    assert result["financial_projection"]["candidate_monthly_value_nzd"] == 126.00
    assert result["financial_projection"]["platform_recovery_value_nzd"] == 25.20
    assert result["economic_truth"]["verified_external_revenue_nzd"] == 0.00
    assert result["economic_truth"]["replication_authorized"] is False


def test_fixture_does_not_extrapolate_150_paid_seats():
    result = reconcile(FIXTURE)
    assert result["billing_contract_total_licenses_paid"] == 150
    assert result["observed_billed_seats_evaluated"] == 5
    assert result["financial_projection"]["candidate_monthly_value_nzd"] == 126.00
