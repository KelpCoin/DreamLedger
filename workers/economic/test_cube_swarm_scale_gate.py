import hashlib
import unittest

from workers.economic.cube_swarm_scale_gate import EMPTY_SHA256, SCHEMA, recommend_scale


def fixture(epv_target=10.0):
    orders = []
    # Synthetic fixtures test policy branches only. They do not represent real sales.
    for i in range(3):
        gross = 300.0
        platform_revenue = 300.0
        fees = 3.0
        fulfilment = 2.0
        provider = 1.0
        orders.append({
            "payment_id": f"pay_{i}",
            "provider_event_id": f"evt_{i}",
            "stripe_session_id": f"cs_test_{i}",
            "x402_tx_hash": "",
            "buyer_key_hash": hashlib.sha256(f"buyer_{i}".encode()).hexdigest(),
            "independent_external_buyer": True,
            "settlement_status": "SETTLED",
            "attribution_status": "VERIFIED",
            "settlement_proof_status": "VERIFIED",
            "fulfillment_status": "FULFILLED",
            "delivery_proof_status": "VERIFIED",
            "delivery_proof_sha256": hashlib.sha256(f"delivery_{i}".encode()).hexdigest(),
            "gross_amount_nzd": gross,
            "platform_revenue_nzd": platform_revenue,
            "processor_fees_nzd": fees,
            "direct_fulfillment_cost_nzd": fulfilment,
            "provider_cost_nzd": provider,
            "refund_amount_nzd": 0,
            "refund_cost_nzd": 0,
        })
    # Synthetic direct-sale fixture: platform revenue is explicit. Net contribution is 882 NZD.
    # These rows are test-only and never constitute live economic evidence.
    visitors = max(3, int(882 / epv_target))
    return {
        "schema": SCHEMA,
        "verified_bundle": {
            "status": "VERIFIED",
            "signature_verified": True,
            "reconciliation_id": "synthetic-test-fixture-only",
            "verified_at_utc": "2026-10-20T00:00:00Z",
            "source": "stripe_reconciliation",
        },
        "window_days": 7,
        "unique_qualified_visitors": visitors,
        "current_workers": 1,
        "pending_verified_signals": 20,
        "capacity_guardrails": {"status": "PASS"},
        "orders": orders,
        "signals_per_second": 497267,
        "simulated_pipeline_value_nzd": 624000,
    }


class CubeSwarmScaleGateTests(unittest.TestCase):
    def test_missing_evidence_fails_closed_even_with_huge_simulation_numbers(self):
        d = recommend_scale({
            "schema": SCHEMA,
            "signals_per_second": 497267,
            "simulated_pipeline_value_nzd": 624000,
            "epv_nzd": 999999,
        })
        self.assertEqual(d["decision"], "HOLD_BASELINE_PREPARE_ONLY")
        self.assertFalse(d["execute_scale"])
        self.assertEqual(d["revenue_claimed_by_gate_nzd"], 0)

    def test_unverified_bundle_cannot_scale(self):
        e = fixture()
        e["verified_bundle"]["signature_verified"] = False
        d = recommend_scale(e)
        self.assertEqual(d["decision"], "HOLD_BASELINE_PREPARE_ONLY")
        self.assertFalse(d["scale_recommended"])

    def test_empty_payload_hash_is_not_delivery_proof(self):
        e = fixture()
        e["orders"][0]["delivery_proof_sha256"] = EMPTY_SHA256
        d = recommend_scale(e)
        self.assertEqual(d["decision"], "HOLD_BASELINE_PREPARE_ONLY")
        self.assertIn("INVALID_OR_EMPTY_DELIVERY_HASH", " ".join(d["blockers"]))

    def test_duplicate_session_cannot_count_twice(self):
        e = fixture()
        e["orders"][1]["stripe_session_id"] = e["orders"][0]["stripe_session_id"]
        d = recommend_scale(e)
        self.assertEqual(d["decision"], "HOLD_BASELINE_PREPARE_ONLY")
        self.assertTrue(any("DUPLICATE" in b for b in d["blockers"]))

    def test_paid_but_unfulfilled_order_blocks_scaling(self):
        e = fixture()
        e["orders"][0]["fulfillment_status"] = "PENDING"
        d = recommend_scale(e)
        self.assertEqual(d["decision"], "HOLD_BASELINE_PREPARE_ONLY")
        self.assertIn("NOT_FULFILLED", " ".join(d["blockers"]))

    def test_low_observed_contribution_epv_recommends_baseline_only(self):
        e = fixture(epv_target=10.0)
        d = recommend_scale(e)
        self.assertEqual(d["decision"], "PRUNE_TO_BASELINE_RECOMMENDATION")
        self.assertEqual(d["recommended_worker_count"], 1)
        self.assertFalse(d["execute_scale"])

    def test_midrange_epv_uses_verified_queue_only(self):
        e = fixture(epv_target=50.0)
        d = recommend_scale(e)
        self.assertEqual(d["decision"], "QUEUE_DEPTH_SCALE_RECOMMENDATION")
        self.assertEqual(d["recommended_worker_count"], 2)
        self.assertFalse(d["production_mutation"])

    def test_high_epv_doubles_only_as_recommendation_and_caps_at_64(self):
        e = fixture(epv_target=150.0)
        e["current_workers"] = 40
        d = recommend_scale(e)
        self.assertEqual(d["decision"], "CLONE_EXPAND_RECOMMENDATION")
        self.assertEqual(d["recommended_worker_count"], 64)
        self.assertFalse(d["execute_scale"])
        self.assertFalse(d["production_mutation"])


    def test_zero_fee_marketplace_gmv_is_not_platform_revenue(self):
        e = fixture(epv_target=50.0)
        for order in e["orders"]:
            order["platform_revenue_nzd"] = 0.0
        d = recommend_scale(e)
        self.assertEqual(d["decision"], "HOLD_BASELINE_PREPARE_ONLY")
        self.assertEqual(d["revenue_claimed_by_gate_nzd"], 0)
        self.assertIn("NON_POSITIVE_NET_CONTRIBUTION_MARGIN", " ".join(d["blockers"]))

    def test_distinct_buyers_cannot_exceed_qualified_visitor_denominator(self):
        e = fixture(epv_target=50.0)
        e["unique_qualified_visitors"] = 2
        d = recommend_scale(e)
        self.assertEqual(d["decision"], "HOLD_BASELINE_PREPARE_ONLY")
        self.assertIn("BUYER_COUNT_EXCEEDS_QUALIFIED_VISITOR_DENOMINATOR", " ".join(d["blockers"]))

    def test_legacy_gmv_only_v1_evidence_is_rejected(self):
        e = fixture()
        e["schema"] = "bec/cube-scale-evidence/v1"
        d = recommend_scale(e)
        self.assertEqual(d["decision"], "HOLD_BASELINE_PREPARE_ONLY")
        self.assertIn("INVALID_OR_MISSING_EVIDENCE_SCHEMA", " ".join(d["blockers"]))

    def test_refunds_and_costs_reduce_net_contribution(self):
        e = fixture(epv_target=50.0)
        e["orders"][0]["refund_amount_nzd"] = e["orders"][0]["gross_amount_nzd"]
        e["orders"][0]["refund_cost_nzd"] = e["orders"][0]["platform_revenue_nzd"]
        d = recommend_scale(e)
        self.assertEqual(d["decision"], "HOLD_BASELINE_PREPARE_ONLY")


if __name__ == "__main__":
    unittest.main()
