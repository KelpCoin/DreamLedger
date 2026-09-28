import unittest
from substrate_survival_gate import evaluate

class TestSubstrateSurvivalGate(unittest.TestCase):
    def test_clean_path_survives(self):
        self.assertEqual(evaluate(), "SURVIVES")

    def test_dependency_without_alternative_blocks(self):
        self.assertEqual(
            evaluate(dependency_failed=True),
            "BLOCKED_BY_SUBSTRATE"
        )

    def test_verified_alternative_reroutes(self):
        self.assertEqual(
            evaluate(dependency_failed=True, alternative_valid=True),
            "SURVIVES_WITH_REROUTE"
        )

    def test_reprice_is_not_block(self):
        self.assertEqual(
            evaluate(reprice_required=True),
            "SURVIVES_WITH_REPRICE"
        )

    def test_unknown_material_cost_is_not_zero(self):
        self.assertEqual(
            evaluate(material_cost_unknown=True),
            "EXPIRED_REASSESSMENT"
        )

    def test_material_uninsured_risk_requires_human(self):
        self.assertEqual(
            evaluate(
                insurance_required=True,
                coverage_available=False,
                uninsured_material=True,
            ),
            "HUMAN_REVIEW_REQUIRED",
        )

    def test_expired_assessment_wins(self):
        self.assertEqual(
            evaluate(substrate_expired=True),
            "EXPIRED_REASSESSMENT"
        )

if __name__ == "__main__":
    unittest.main()
