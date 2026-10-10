import unittest
from venture_hypothesis import evaluate, CORE_GATES, SCALE_WEIGHTS


def hypothesis(h_values=None, e_values=None, scale_values=None):
    return {
        "id": "TEST-1",
        "h_scores": {k: (h_values or {}).get(k, 8) for k in CORE_GATES},
        "e_scores": {k: (e_values or {}).get(k, 2) for k in CORE_GATES},
        "scale_scores": {k: (scale_values or {}).get(k, 8) for k in SCALE_WEIGHTS},
        "evidence_state": "UNVERIFIED",
        "evidence_refs": [],
    }


class VentureHypothesisTests(unittest.TestCase):
    def test_missing_scores_hold(self):
        result = evaluate({"id": "MISSING"})
        self.assertEqual(result["decision"], "HOLD_MISSING_SCORES")

    def test_hypothesis_with_low_evidence_does_not_proceed(self):
        result = evaluate(hypothesis())
        self.assertEqual(result["decision"], "ITERATE")
        self.assertEqual(result["evidence_state"], "UNVERIFIED")

    def test_low_h_with_high_evidence_pivots(self):
        result = evaluate(hypothesis(h_values={"economic_buyer": 6}, e_values={k: 8 for k in CORE_GATES}))
        self.assertEqual(result["decision"], "PIVOT")

    def test_low_h_with_low_evidence_kills(self):
        result = evaluate(hypothesis(h_values={"economic_buyer": 6}, e_values={k: 2 for k in CORE_GATES}))
        self.assertEqual(result["decision"], "KILL")

    def test_invalid_score_rejected(self):
        with self.assertRaises(ValueError):
            evaluate(hypothesis(h_values={"market_size": 11}))

    def test_high_evidence_and_hypothesis_scale_can_proceed(self):
        result = evaluate(hypothesis(e_values={k: 8 for k in CORE_GATES}))
        self.assertEqual(result["decision"], "PROCEED_TO_TEST_LAYER")
        self.assertEqual(result["weighted_scale_score"], 80.0)

    def test_weighted_scale_score(self):
        scales = {k: 5 for k in SCALE_WEIGHTS}
        result = evaluate(hypothesis(e_values={k: 8 for k in CORE_GATES}, scale_values=scales))
        self.assertEqual(result["weighted_scale_score"], 50.0)
        self.assertEqual(result["decision"], "KILL")


if __name__ == "__main__":
    unittest.main()
