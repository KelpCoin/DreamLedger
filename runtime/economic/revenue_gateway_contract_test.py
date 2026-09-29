import unittest

from revenue_gateway_contract import (
    CapabilityFacts,
    GatewayConfig,
    ServicePromise,
    ContractError,
    decide,
)


def facts(**overrides):
    base = dict(
        database=True,
        storage=True,
        payment_boundary=True,
        fulfillment_worker=True,
        extraction_comparison=True,
        output_generation=True,
        delivery=True,
        fallback_available=False,
        queue_available=False,
        health_fresh=True,
        commercial_contract_aligned=True,
    )
    base.update(overrides)
    return CapabilityFacts(**base)


class RevenueGatewayContractTests(unittest.TestCase):
    def test_full(self):
        d = decide(GatewayConfig("QUOTE-COMPARE-49", ServicePromise.FULL), facts())
        self.assertEqual(d.mode, ServicePromise.FULL)
        self.assertTrue(d.can_accept_payment)

    def test_reduced(self):
        cfg = GatewayConfig("QUOTE-COMPARE-49", ServicePromise.FULL, fallback_path="manual-explicit-unresolved")
        d = decide(cfg, facts(storage=False, fallback_available=True))
        self.assertEqual(d.mode, ServicePromise.REDUCED)
        self.assertTrue(d.can_accept_payment)

    def test_queued_requires_human_policy(self):
        cfg = GatewayConfig("QUOTE-COMPARE-49", ServicePromise.QUEUED, queue_capacity=10, queue_max_age_seconds=3600)
        d = decide(cfg, facts(queue_available=True))
        self.assertEqual(d.mode, ServicePromise.QUEUED)
        self.assertFalse(d.can_accept_payment)
        self.assertEqual(d.reason_code, "HUMAN_POLICY_REQUIRED")

    def test_refused(self):
        d = decide(GatewayConfig("QUOTE-COMPARE-49", ServicePromise.FULL), facts(storage=False))
        self.assertEqual(d.mode, ServicePromise.REFUSED)
        self.assertFalse(d.can_accept_payment)

    def test_provider_failure(self):
        d = decide(GatewayConfig("QUOTE-COMPARE-49", ServicePromise.FULL), facts(fulfillment_worker=False))
        self.assertEqual(d.mode, ServicePromise.REFUSED)

    def test_fallback_unavailable(self):
        cfg = GatewayConfig("QUOTE-COMPARE-49", ServicePromise.FULL, fallback_path="fallback")
        d = decide(cfg, facts(storage=False, fallback_available=False))
        self.assertEqual(d.mode, ServicePromise.REFUSED)

    def test_queue_unavailable(self):
        cfg = GatewayConfig("QUOTE-COMPARE-49", ServicePromise.QUEUED, queue_capacity=1, queue_max_age_seconds=60)
        d = decide(cfg, facts(queue_available=False))
        self.assertEqual(d.mode, ServicePromise.REFUSED)

    def test_invalid_missing_sku(self):
        with self.assertRaises(ContractError):
            decide(GatewayConfig("", ServicePromise.FULL), facts())

    def test_invalid_reduced_configuration(self):
        with self.assertRaises(ContractError):
            decide(GatewayConfig("QUOTE-COMPARE-49", ServicePromise.REDUCED), facts())

    def test_invalid_queue_configuration(self):
        with self.assertRaises(ContractError):
            decide(GatewayConfig("QUOTE-COMPARE-49", ServicePromise.QUEUED, queue_capacity=0, queue_max_age_seconds=60), facts())

    def test_stale_health(self):
        d = decide(GatewayConfig("QUOTE-COMPARE-49", ServicePromise.FULL), facts(health_fresh=False))
        self.assertEqual(d.mode, ServicePromise.REFUSED)

    def test_conflicting_configuration(self):
        d = decide(GatewayConfig("QUOTE-COMPARE-49", ServicePromise.FULL), facts(commercial_contract_aligned=False))
        self.assertEqual(d.mode, ServicePromise.REFUSED)
        self.assertEqual(d.reason_code, "COMMERCIAL_CONTRACT_CONFLICT")

    def test_atomicity_is_not_removed(self):
        d = decide(GatewayConfig("QUOTE-COMPARE-49", ServicePromise.FULL), facts())
        self.assertTrue(d.atomicity_gap)
        self.assertEqual(d.economic_effect, 0)


if __name__ == "__main__":
    unittest.main()
