import unittest
from access_bridge import build_access_plan, build_access_case_packet, list_routes

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
        self.assertTrue(any("assigned lawyer" in item for item in plan["checklist"]))

    def test_hamilton_routes_to_waikato_community_law(self):
        ids = {route["id"] for route in list_routes(["legal_aid"], "Hamilton")}
        self.assertIn("community_law_waikato", ids)

    def test_food_and_medical_costs_route(self):
        routes = list_routes(["food", "medical_costs"])
        self.assertIn("urgent_costs", {route["id"] for route in routes})

    def test_case_packet_preserves_supplied_facts_and_flags_unknowns(self):
        packet = build_access_case_packet(
            "criminal legal aid", "A case is delayed", "Written next steps",
            timeline=["2026-09-01: contacted service"], prior_attempts=["Called, no response"],
        )
        self.assertEqual(packet["mode"], "DRAFT_ONLY")
        self.assertFalse(packet["personal_data_persisted"])
        self.assertEqual(packet["timeline"], ["2026-09-01: contacted service"])
        self.assertEqual(packet["deadline"], "UNKNOWN")
        self.assertTrue(packet["missing_information"])

if __name__ == "__main__":
    unittest.main()
