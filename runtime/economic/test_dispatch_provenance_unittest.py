"""Fail-closed dispatch provenance regression: executable using stdlib unittest.

These are synthetic policy fixtures. They do not imply live production
execution, authorized external actions, or verified economic revenue.
"""
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parent))
from state_transition_engine import transition_opportunity
from production_observation_probe import inspect_action
from production_observation_contract import observe_action


class DispatchProvenanceTests(unittest.TestCase):
    def test_internal_trace_never_executes(self):
        t = transition_opportunity("AUTHORIZED", "ACTION_DISPATCHED", {"worker_trace": True})
        self.assertIsNone(t.state_after)
        self.assertEqual(t.error_class, "EXTERNAL_RESULT_REQUIRED")
        self.assertEqual(t.missing_field, "external_result_receipt_id")

    def test_sent_request_is_not_result(self):
        t = transition_opportunity("AUTHORIZED", "EXTERNAL_ACTION_SENT", {"worker_trace": True})
        self.assertIsNone(t.state_after)
        self.assertEqual(t.error_class, "EXTERNAL_RESULT_REQUIRED")

    def test_result_without_receipt_blocks(self):
        t = transition_opportunity("AUTHORIZED", "EXTERNAL_RESULT_OBSERVED", {"external_result_verified": True})
        self.assertIsNone(t.state_after)
        self.assertEqual(t.missing_field, "external_result_receipt_id")

    def test_result_without_authentication_blocks(self):
        t = transition_opportunity("AUTHORIZED", "EXTERNAL_RESULT_OBSERVED", {"external_result_receipt_id": "receipt_X"})
        self.assertIsNone(t.state_after)
        self.assertEqual(t.error_class, "EXTERNAL_RESULT_UNVERIFIED")

    def test_blank_receipt_blocks(self):
        t = transition_opportunity("AUTHORIZED", "EXTERNAL_RESULT_OBSERVED",
                                   {"external_result_receipt_id": "  ", "external_result_verified": True})
        self.assertIsNone(t.state_after)
        self.assertEqual(t.missing_field, "external_result_receipt_id")

    def test_only_trusted_observation_contract_can_progress(self):
        t = transition_opportunity("AUTHORIZED", "EXTERNAL_RESULT_OBSERVED",
                                   {"external_result_receipt_id": "receipt_X", "external_result_verified": True})
        self.assertEqual(t.state_after, "EXECUTED")

    def test_observation_probe_blocks_internal_only(self):
        row = {"opportunity_state": "AUTHORIZED", "authorization_verdict": "allow",
               "dispatch_state": "INTERNAL_ROUTED", "transition_context": {"worker_trace": True}}
        for inspect in (inspect_action, observe_action):
            d = inspect(row)
            self.assertEqual(d["result"], "EXACT_BLOCKER")
            self.assertEqual(d["error_class"], "EXTERNAL_RESULT_REQUIRED")
            self.assertNotIn("state_after", d)

    def test_observation_probe_does_not_upgrade_external_send(self):
        row = {"opportunity_state": "AUTHORIZED", "authorization_verdict": "allow",
               "dispatch_state": "EXTERNAL_SENT", "transition_context": {"worker_trace": True}}
        for inspect in (inspect_action, observe_action):
            d = inspect(row)
            self.assertEqual(d["result"], "EXACT_BLOCKER")
            self.assertEqual(d["missing_field"], "external_result_receipt_id")

    def test_authenticated_external_response_projection_requires_receipt(self):
        row = {"opportunity_state": "AUTHORIZED", "authorization_verdict": "allow",
               "dispatch_state": "EXTERNAL_RESULT_OBSERVED",
               "transition_context": {"external_result_receipt_id": "receipt_X",
                                      "external_result_verified": True}}
        for inspect in (inspect_action, observe_action):
            d = inspect(row)
            self.assertEqual(d["result"], "NEXT_STATE")
            self.assertEqual(d["state_after"], "EXECUTED")

    def test_internal_execution_packet_is_not_external(self):
        d = inspect_action({"opportunity_state": "AUTHORIZED", "action_type": "BUILD_EXECUTION_PACKET",
                            "dispatch_state": "EXTERNAL_RESULT_OBSERVED",
                            "transition_context": {"external_result_receipt_id": "r", "external_result_verified": True}})
        self.assertEqual(d["result"], "EXACT_BLOCKER")
        self.assertEqual(d["error_class"], "INTERNAL_PLANNING_ACTION")


if __name__ == "__main__":
    unittest.main()
