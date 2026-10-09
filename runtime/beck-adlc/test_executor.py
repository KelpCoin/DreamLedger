import hashlib
import json
import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from executor import execute_intent


NOW = datetime(2026, 10, 9, 12, 0, tzinfo=timezone.utc)


class MemoryTestStore:
    """Ephemeral test double only. Never use this as production persistence."""

    def __init__(self):
        self.reservations = {}
        self.results = {}
        self.evidence = []

    def reserve(self, key, fingerprint):
        prior = self.reservations.get(key)
        if prior is None:
            self.reservations[key] = {"fingerprint": fingerprint, "state": "IN_PROGRESS"}
            return "NEW", None
        if prior["fingerprint"] != fingerprint:
            return "CONFLICT", None
        if prior["state"] == "COMPLETE":
            return "REPLAY", self.results[key]
        return "IN_PROGRESS", None

    def complete(self, key, fingerprint, result, evidence):
        current = self.reservations.get(key)
        if not current or current["fingerprint"] != fingerprint or current["state"] != "IN_PROGRESS":
            raise RuntimeError("reservation mismatch")
        self.results[key] = result
        self.evidence.append(evidence)
        self.reservations[key]["state"] = "COMPLETE"

    def record_evidence(self, evidence):
        self.evidence.append(evidence)


class BoundedExecutorTests(unittest.TestCase):
    def setUp(self):
        self.store = MemoryTestStore()
        self.contract = {
            "contract_id": "dreamledger.beck.bounded-execution.v1",
            "status": "ACTIVE",
            "allowed_action_types": ["READ_TEST_FIXTURE"],
            "allowed_targets": {"READ_TEST_FIXTURE": ["fixture:demo"]},
            "limits": {
                "max_attempts": 1,
                "max_duration_seconds": 30,
                "max_api_calls": 0,
                "max_spend_minor_units": 0,
                "max_payload_bytes": 1024,
            },
        }
        self.intent = {
            "intent_id": "intent-test-0001",
            "action_type": "READ_TEST_FIXTURE",
            "target": "fixture:demo",
            "issued_at": "2026-10-09T11:59:00Z",
            "idempotency_key": "idem-test-0001",
            "payload": {"fixture": "demo"},
            "limits": {
                "max_attempts": 1,
                "max_duration_seconds": 10,
                "max_api_calls": 0,
                "max_spend_minor_units": 0,
            },
        }
        self.authority = {
            "state": "APPROVED",
            "reference": "gate-test-0001",
            "intent_id": self.intent["intent_id"],
            "action_type": self.intent["action_type"],
            "target": self.intent["target"],
            "expires_at": "2026-10-09T12:05:00Z",
        }
        self.calls = []
        self.actions = {
            ("READ_TEST_FIXTURE", "fixture:demo"): lambda payload: (
                self.calls.append(payload["fixture"]) or {"fixture_value": "TEST_ONLY"}
            )
        }

    def run_intent(self, intent=None, authority=None, actions=None):
        return execute_intent(
            intent if intent is not None else self.intent,
            authority if authority is not None else self.authority,
            self.contract,
            self.store,
            actions if actions is not None else self.actions,
            now=NOW,
        )

    def assert_evidence_hash_valid(self, evidence):
        unhashed = dict(evidence)
        digest = unhashed.pop("evidence_sha256")
        canonical = json.dumps(unhashed, sort_keys=True, separators=(",", ":"), ensure_ascii=False, default=str)
        self.assertEqual(digest, hashlib.sha256(canonical.encode("utf-8")).hexdigest())

    def test_authorized_action_executes_and_evidence_is_checkable(self):
        result = self.run_intent()
        self.assertEqual(result["decision"], "ALLOW")
        self.assertEqual(result["execution_state"], "TEST_ACTION_COMPLETED")
        self.assertEqual(result["result"]["fixture_value"], "TEST_ONLY")
        self.assertEqual(self.calls, ["demo"])
        self.assertEqual(len(self.store.evidence), 1)
        self.assert_evidence_hash_valid(result)

    def test_replay_returns_prior_result_without_second_execution(self):
        first = self.run_intent()
        second = self.run_intent()
        self.assertEqual(first["result"], second["result"])
        self.assertTrue(second["replayed"])
        self.assertEqual(self.calls, ["demo"])

    def test_unauthorized_target_is_denied_and_recorded(self):
        intent = dict(self.intent, target="production:database")
        result = self.run_intent(intent=intent)
        self.assertEqual(result["decision"], "DENY")
        self.assertEqual(result["execution_state"], "NOT_DISPATCHED")
        self.assertEqual(self.calls, [])
        self.assertEqual(len(self.store.evidence), 1)
        self.assert_evidence_hash_valid(result)

    def test_unapproved_authority_is_denied(self):
        authority = dict(self.authority, state="PENDING")
        result = self.run_intent(authority=authority)
        self.assertEqual(result["decision"], "DENY")
        self.assertEqual(self.calls, [])

    def test_unregistered_action_is_denied_before_reservation(self):
        result = self.run_intent(actions={})
        self.assertEqual(result["decision"], "DENY")
        self.assertIn("ACTION_ADAPTER_NOT_REGISTERED", result["reason_codes"])
        self.assertEqual(self.store.reservations, {})
        self.assertEqual(self.calls, [])

    def test_action_exception_fails_closed_with_unknown_state(self):
        def broken(_payload):
            raise TimeoutError("test timeout")
        result = self.run_intent(actions={("READ_TEST_FIXTURE", "fixture:demo"): broken})
        self.assertEqual(result["decision"], "DENY")
        self.assertEqual(result["execution_state"], "UNKNOWN")
        self.assertIn("ACTION_FAILED", result["reason_codes"])
        self.assertEqual(len(self.store.evidence), 1)

    def test_in_progress_replay_fails_closed(self):
        from executor import _canonical
        fingerprint = _canonical(self.intent)
        self.store.reservations[self.intent["idempotency_key"]] = {
            "fingerprint": fingerprint, "state": "IN_PROGRESS"
        }
        result = self.run_intent()
        self.assertEqual(result["decision"], "DENY")
        self.assertIn("IDEMPOTENCY_IN_PROGRESS", result["reason_codes"])
        self.assertEqual(self.calls, [])


if __name__ == "__main__":
    unittest.main()
