import unittest
from access_bridge import build_access_plan, list_routes

class AccessBridgeTests(unittest.TestCase):
    def test_health_and_legal_routes_are_available(self):
        routes = list_routes(["healthcare", "legal_aid"])
        ids = {route["id"] for route in routes}
        self.assertIn("healthline", ids)
        self.assertIn("legal_aid", ids)
        self.assertIn("health_advocacy", ids)

    def test_plan_is_draft_only_and_does_not_persist_data(self):
        plan = build_access_plan(["healthcare", "legal_aid"], barrier="Need accessible follow-up")
        self.assertEqual(plan["mode"], "DRAFT_ONLY")
        self.assertFalse(plan["personal_data_persisted"])
        self.assertFalse(plan["external_actions_taken"])
        self.assertIn("Need accessible follow-up", plan["message_draft"])

    def test_food_and_medical_costs_route(self):
        routes = list_routes(["food", "medical_costs"])
        self.assertIn("urgent_costs", {route["id"] for route in routes})

    def test_unknown_category_does_not_crash(self):
        self.assertEqual(list_routes(["not-a-real-category"]), [])

if __name__ == "__main__":
    unittest.main()
