import unittest

from scripts.bridge_ping import required_context_for_task
from scripts.bridge_process_inbox import classify_ping


class AgentBridgeProductizationContextTests(unittest.TestCase):
    def test_every_ping_declares_canonical_spine(self):
        reads, commercial, beck = required_context_for_task("handoff", "repair scheduler")
        self.assertIn("AGENT_BUS/BRIDGE/PROTOCOL.md", reads)
        self.assertIn("AGENT_BUS/MONEY-PLAYBOOK-500.md", reads)
        self.assertFalse(commercial)
        self.assertFalse(beck)

    def test_commercial_ping_declares_catalog(self):
        reads, commercial, beck = required_context_for_task("commercial", "find first buyer")
        self.assertTrue(commercial)
        self.assertIn("AGENT_BUS/BRIDGE/COMMERCIAL_ROUTES_CATALOG.md", reads)
        self.assertFalse(beck)

    def test_beck_ping_declares_productization_plan(self):
        reads, commercial, beck = required_context_for_task("handoff", "BECK bounded runtime package")
        self.assertTrue(beck)
        self.assertIn("AGENT_BUS/BRIDGE/BECK_PRODUCTIZATION_GTM.md", reads)

    def test_rejects_beck_task_without_productization_context(self):
        decision = classify_ping({
            "schema": "dreamledger/agent-bridge-ping/v1",
            "intent": "handoff",
            "summary": "BECK bounded runtime package",
            "reads": ["AGENT_BUS/BRIDGE/PROTOCOL.md", "AGENT_BUS/MONEY-PLAYBOOK-500.md"],
            "revenue_claim_nzd": 0,
        })
        self.assertEqual(decision["status"], "rejected")
        self.assertIn("BECK_PRODUCTIZATION_GTM.md", decision["summary"])

    def test_accepts_beck_task_with_required_context(self):
        decision = classify_ping({
            "schema": "dreamledger/agent-bridge-ping/v1",
            "intent": "handoff",
            "summary": "BECK bounded runtime package",
            "reads": [
                "AGENT_BUS/BRIDGE/PROTOCOL.md",
                "AGENT_BUS/MONEY-PLAYBOOK-500.md",
                "AGENT_BUS/BRIDGE/BECK_PRODUCTIZATION_GTM.md",
            ],
            "revenue_claim_nzd": 0,
        })
        self.assertEqual(decision["status"], "accepted")
        self.assertTrue(decision["beck_context_required"])

    def test_commercial_ping_still_requires_money_playbook(self):
        decision = classify_ping({
            "schema": "dreamledger/agent-bridge-ping/v1",
            "intent": "commercial",
            "summary": "validate Pro offer",
            "reads": ["AGENT_BUS/BRIDGE/PROTOCOL.md"],
            "revenue_claim_nzd": 0,
        })
        self.assertEqual(decision["status"], "rejected")

    def test_revenue_claim_cannot_be_fabricated(self):
        decision = classify_ping({
            "schema": "dreamledger/agent-bridge-ping/v1",
            "intent": "commercial",
            "summary": "BECK Pro",
            "reads": [
                "AGENT_BUS/BRIDGE/PROTOCOL.md",
                "AGENT_BUS/MONEY-PLAYBOOK-500.md",
                "AGENT_BUS/BRIDGE/BECK_PRODUCTIZATION_GTM.md",
            ],
            "revenue_claim_nzd": 49,
        })
        self.assertEqual(decision["status"], "rejected")


if __name__ == "__main__":
    unittest.main()
