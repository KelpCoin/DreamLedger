import unittest
from substrate_admission import assess_trace


class TestSubstrateAdmission(unittest.TestCase):
    def test_clean_trace_survives(self):
        r = assess_trace({
            "economic_trace_id": "ET-1",
            "action_id": "A-1",
            "opportunity_id": "O-1",
            "worker_resource_status": "AVAILABLE",
            "cost_status": "KNOWN",
        })
        self.assertEqual(r["admission"], "SURVIVES")

    def test_502_without_alternative_blocks(self):
        r = assess_trace({
            "economic_trace_id": "ET-2",
            "worker_resource_status": "FAILED",
            "failure_class": "WORKER_RESOURCE_LIMIT",
            "cost_status": "KNOWN",
        })
        self.assertEqual(r["admission"], "BLOCKED_BY_SUBSTRATE")

    def test_502_with_alternative_reroutes(self):
        r = assess_trace({
            "economic_trace_id": "ET-3",
            "worker_resource_status": "FAILED",
            "failure_class": "WORKER_RESOURCE_LIMIT",
            "cost_status": "KNOWN",
        }, alternative_valid=True)
        self.assertEqual(r["admission"], "SURVIVES_WITH_REROUTE")

    def test_unknown_cost_never_becomes_zero(self):
        r = assess_trace({
            "economic_trace_id": "ET-4",
            "worker_resource_status": "AVAILABLE",
            "cost_status": "UNKNOWN",
        })
        self.assertEqual(r["admission"], "EXPIRED_REASSESSMENT")
        self.assertTrue(r["material_cost_unknown"])

    def test_identity_is_preserved(self):
        r = assess_trace({
            "economic_trace_id": "ET-5",
            "action_id": "A-5",
            "opportunity_id": "O-5",
            "worker_resource_status": "AVAILABLE",
            "cost_status": "KNOWN",
        })
        self.assertEqual(r["economic_trace_id"], "ET-5")
        self.assertEqual(r["action_id"], "A-5")
        self.assertEqual(r["opportunity_id"], "O-5")


if __name__ == "__main__":
    unittest.main()
