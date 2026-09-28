import os
import tempfile
import unittest
from pathlib import Path

os.environ.setdefault("SUPABASE_URL", "https://example.invalid")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "TEST_ONLY")

import economic_fulfillment_worker as worker


class TestEconomicFulfillmentSubstratePath(unittest.TestCase):
    def test_run_once_routes_unknown_cost_to_substrate_admission(self):
        seen = {}
        failed = {}

        old_root = worker.ROOT
        old_claim = worker.claim
        old_run = worker.run
        old_upload = worker.upload
        old_fail = worker.fail
        old_assess = worker.assess_trace

        with tempfile.TemporaryDirectory() as tmp:
            worker.ROOT = Path(tmp)

            def fake_claim():
                return {
                    "id": "JOB-LIVE-PATH-001",
                    "lease_token": "LEASE-TEST",
                    "payload": {
                        "action_id": "ACTION-LIVE-001",
                        "opportunity_id": "OPPORTUNITY-LIVE-001",
                        "sources": [{"type": "html_links", "url": "https://example.invalid"}],
                    },
                }

            def fake_run(payload):
                return {"row_count": 0, "rows": [], "evidence": []}

            def fake_assess(trace):
                seen["trace"] = dict(trace)
                return {
                    "admission": "EXPIRED_REASSESSMENT",
                    "economic_trace_id": trace["economic_trace_id"],
                    "action_id": trace["action_id"],
                    "opportunity_id": trace["opportunity_id"],
                    "dependency_failed": False,
                    "material_cost_unknown": True,
                    "source": "ECONOMIC_COMPUTE_TRACE",
                }

            def fake_upload(path, storage_path):
                seen["uploaded"] = storage_path
                return 200

            def fake_fail(job, reason):
                failed["reason"] = reason
                return {"ok": True}

            worker.claim = fake_claim
            worker.run = fake_run
            worker.assess_trace = fake_assess
            worker.upload = fake_upload
            worker.fail = fake_fail

            try:
                self.assertTrue(worker.run_once())
            finally:
                worker.claim = old_claim
                worker.run = old_run
                worker.assess_trace = old_assess
                worker.upload = old_upload
                worker.fail = old_fail
                worker.ROOT = old_root

        self.assertEqual(seen["trace"]["action_id"], "ACTION-LIVE-001")
        self.assertEqual(seen["trace"]["opportunity_id"], "OPPORTUNITY-LIVE-001")
        self.assertEqual(seen["trace"]["compute_cost_status"], "UNKNOWN")
        self.assertIn("SUBSTRATE_ADMISSION", failed["reason"])
        self.assertIn("EXPIRED_REASSESSMENT", failed["reason"])


if __name__ == "__main__":
    unittest.main()
