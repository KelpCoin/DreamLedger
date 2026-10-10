import unittest
from access_bridge import (
    build_access_plan, build_access_case_packet, list_routes,
    list_healthcare_funding_options, resolve_barrier_evidence,
)

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
        self.assertTrue(plan["healthcare_funding_options"])

    def test_baywide_route_uses_tauranga_contact_details(self):
        route = next(route for route in list_routes(["legal_aid"], "Bay of Plenty") if route["id"] == "community_law_bop")
        self.assertIn("0800 905 916", route["contact"])
        self.assertIn("07) 571 6812", route["contact"])
        self.assertIn("tauranga@baywidecls.org.nz", route["contact"])

    def test_hamilton_routes_to_waikato_community_law(self):
        ids = {route["id"] for route in list_routes(["legal_aid"], "Hamilton")}
        self.assertIn("community_law_waikato", ids)
        self.assertNotIn("community_law_bop", ids)

    def test_unknown_route_category_returns_no_guessed_routes(self):
        self.assertEqual(list_routes(["not-a-real-category"]), [])

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

    def test_healthcare_funding_routes_include_limits_and_evidence(self):
        options = list_healthcare_funding_options()
        ids = {option["id"] for option in options}
        self.assertIn("winz_disability_allowance", ids)
        self.assertIn("winz_special_needs_grant", ids)
        allowance = next(option for option in options if option["id"] == "winz_disability_allowance")
        self.assertIn("82.85", allowance["maximum_rate"])
        self.assertIn("not guaranteed", allowance["maximum_rate"].lower())
        self.assertIn("provider_payment_options", ids)
        grant = next(option for option in options if option["id"] == "winz_special_needs_grant")
        self.assertIn("not guaranteed", grant["limitation"].lower())
        self.assertTrue(grant["proof_to_prepare"])

    def test_healthcare_case_packet_does_not_claim_funding_approval(self):
        packet = build_access_case_packet("healthcare", "Cannot afford private consultation", "Find a viable care route")
        self.assertTrue(packet["healthcare_funding_options"])
        self.assertEqual(packet["mode"], "DRAFT_ONLY")
        self.assertFalse(packet["external_actions_taken"])

    def test_multiple_barriers_produce_separate_evidence_requirements(self):
        packet = build_access_case_packet(
            "healthcare", "Public route is not working and private care costs too much",
            "Identify an affordable route to appropriate care",
            barriers=["public_system_access", "private_care_cost", "communication"],
        )
        evidence = packet["barrier_evidence"]["barriers"]
        ids = {item["id"] for item in evidence}
        self.assertEqual(ids, {"public_system_access", "private_care_cost", "communication"})
        private = next(item for item in evidence if item["id"] == "private_care_cost")
        self.assertTrue(any("itemised written quote" in item.lower() for item in private["evidence"]))
        self.assertTrue(packet["healthcare_funding_options"])
        self.assertFalse(packet["external_actions_taken"])
        self.assertFalse(packet["personal_data_persisted"])

    def test_unknown_barrier_is_not_inferred_from_summary(self):
        packet = build_access_case_packet(
            "healthcare", "Several barriers at once", "Help me access care",
            barriers=["unfamiliar barrier"],
        )
        self.assertEqual(packet["barrier_evidence"]["barriers"], [])
        self.assertEqual(packet["barrier_evidence"]["unclassified_barriers"], ["unfamiliar_barrier"])
        self.assertTrue(any("unclassified" in gap.lower() for gap in packet["missing_information"]))

if __name__ == "__main__":
    unittest.main()
