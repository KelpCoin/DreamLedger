"""Regression tests for production economic observation semantics."""

import unittest

from event_projection import project_action
from production_observation_probe import inspect_action


class InternalPacketProjectionTests(unittest.TestCase):
    def test_build_execution_packet_is_not_economic_dispatch(self):
        row = {
            "action_type": "BUILD_EXECUTION_PACKET",
            "status": "PREPARED",
            "dispatch_state": "INTERNAL_ROUTED",
            "authorization_verdict": "allow",
            "opportunity_state": "AUTHORIZED",
        }
        self.assertEqual(project_action(row), [])
        result = inspect_action(row)
        self.assertEqual(result["result"], "EXACT_BLOCKER")
        self.assertEqual(result["error_class"], "INTERNAL_PLANNING_ACTION")
        self.assertEqual(result["dependency_state"], "OBSERVED_INTERNAL_ROUTING")
        self.assertEqual(result["missing_field"], "external_economic_action")
        self.assertEqual(result["events"], [])

    def test_external_action_still_projects(self):
        row = {
            "action_type": "SEND_OUTREACH",
            "status": "PREPARED",
            "dispatch_state": "EXTERNAL_SENT",
            "authorization_verdict": "allow",
            "opportunity_state": "AUTHORIZED",
        }
        events = project_action(row)
        self.assertIn({"event_type": "ACTION_PREPARED"}, events)
        self.assertIn({"event_type": "ACTION_AUTHORIZED"}, events)
        self.assertIn({"event_type": "EXTERNAL_ACTION_SENT"}, events)


if __name__ == "__main__":
    unittest.main()
