import unittest

from care_funding_gap import build_care_funding_gap_plan


class CareFundingGapTests(unittest.TestCase):
    def test_gap_counts_only_confirmed_support_and_settled_available_funds(self):
        plan = build_care_funding_gap_plan(
            itemised_care_quote_nzd=1200,
            confirmed_support_nzd=200,
            cash_already_set_aside_nzd=100,
            settled_and_available_care_fund_nzd=50,
        )
        self.assertEqual(plan["remaining_gap_nzd"], 850)
        self.assertEqual(plan["funding_gap_status"], "GAP_REMAINS")
        self.assertIsNone(plan["fulfilled_sales_scenario"])

    def test_sales_are_scenario_not_revenue_claim(self):
        plan = build_care_funding_gap_plan(
            itemised_care_quote_nzd=1000,
            verified_net_contribution_per_fulfilled_sale_nzd=149,
        )
        self.assertEqual(plan["fulfilled_sales_scenario"]["sales_needed"], 7)
        self.assertIn("Scenario only", plan["fulfilled_sales_scenario"]["basis"])
        self.assertIn("does not establish demand", plan["limitations"][1])

    def test_zero_gap_requires_no_sales(self):
        plan = build_care_funding_gap_plan(
            itemised_care_quote_nzd=500,
            confirmed_support_nzd=500,
            verified_net_contribution_per_fulfilled_sale_nzd=149,
        )
        self.assertEqual(plan["funding_gap_status"], "COVERED_ON_INPUTS")
        self.assertEqual(plan["fulfilled_sales_scenario"]["sales_needed"], 0)

    def test_zero_contribution_does_not_divide_by_zero(self):
        plan = build_care_funding_gap_plan(
            itemised_care_quote_nzd=500,
            verified_net_contribution_per_fulfilled_sale_nzd=0,
        )
        self.assertIsNone(plan["fulfilled_sales_scenario"]["sales_needed"])

    def test_rejects_negative_nonfinite_or_boolean_amounts(self):
        for bad in (-1, float("inf"), float("nan"), True):
            with self.subTest(value=bad):
                with self.assertRaises((TypeError, ValueError)):
                    build_care_funding_gap_plan(itemised_care_quote_nzd=bad)

    def test_no_private_case_details_or_storage_surface(self):
        plan = build_care_funding_gap_plan(itemised_care_quote_nzd=99)
        self.assertNotIn("diagnosis", plan)
        self.assertNotIn("provider_name", plan)
        self.assertIn("does not persist or log", plan["privacy"])


if __name__ == "__main__":
    unittest.main()
