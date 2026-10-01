import unittest

from CORTEX.gauntlet_adapter import evaluate


class FalseDoneGateTests(unittest.TestCase):
    def test_done_claim_without_completion_evidence_is_rejected(self):
        """Gate 1: a model cannot promote an unverified DONE claim."""
        artifact = {
            "artifact_id": "GATE1-FALSE-DONE-001",
            "job_id": "gate1-false-done",
            "silo_id": "SILO_GENERAL",
            "status": "done",
            "score": 100,
            "reasons": ["model reported completion"],
            "evidence_refs": [],
        }

        result = evaluate(artifact)

        self.assertIn(
            result["decision"],
            {"FAIL", "QUARANTINE", "NEEDS_EVIDENCE"},
            "A DONE claim with no completion evidence must never PASS.",
        )
        self.assertNotEqual(result["decision"], "PASS")


if __name__ == "__main__":
    unittest.main()
