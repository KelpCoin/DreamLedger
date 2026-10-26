import importlib.util
import pathlib
import sys
import unittest
from unittest.mock import patch

MODULE_PATH = pathlib.Path(__file__).resolve().parents[1] / "BEC-PRIME" / "marketplace" / "figure_eight_council.py"
SPEC = importlib.util.spec_from_file_location("figure_eight_council", MODULE_PATH)
COUNCIL = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = COUNCIL
SPEC.loader.exec_module(COUNCIL)


class ProviderConfigTests(unittest.TestCase):
    def test_requires_two_distinct_models(self):
        raw = '[{"name":"local","base_url":"http://127.0.0.1:1234/v1","model":"m1","api_key_env":"NONE"}]'
        with self.assertRaises(COUNCIL.CouncilError):
            COUNCIL.load_providers(raw)

    def test_accepts_two_distinct_models(self):
        raw = '[{"name":"local","base_url":"http://127.0.0.1:1234/v1","model":"m1","api_key_env":"NONE"},{"name":"remote","base_url":"https://example.invalid/v1","model":"m2","api_key_env":"TEST_KEY"}]'
        self.assertEqual(len(COUNCIL.load_providers(raw)), 2)

    def test_deduplicates_model_identity(self):
        raw = '[{"name":"same","base_url":"https://a.invalid/v1","model":"m","api_key_env":"A"},{"name":"same","base_url":"https://b.invalid/v1","model":"m","api_key_env":"B"}]'
        with self.assertRaises(COUNCIL.CouncilError):
            COUNCIL.load_providers(raw)

    def test_canonical_hash_is_order_independent(self):
        self.assertEqual(COUNCIL.canonical_hash({"a": 1, "b": 2}), COUNCIL.canonical_hash({"b": 2, "a": 1}))

    def test_requires_tenant_and_silo(self):
        providers = [
            COUNCIL.Provider("a", "https://a.invalid/v1", "m1", "A"),
            COUNCIL.Provider("b", "https://b.invalid/v1", "m2", "B"),
        ]
        with self.assertRaises(COUNCIL.CouncilError):
            COUNCIL.refine_candidate({"title": "x"}, tenant_id="", silo_id="b2b", providers=providers)

    def test_round_trip_is_iterative_and_never_authorizes_publish(self):
        providers = [
            COUNCIL.Provider("a", "https://a.invalid/v1", "m1", "A"),
            COUNCIL.Provider("b", "https://b.invalid/v1", "m2", "B"),
        ]
        with patch.object(COUNCIL, "_request", side_effect=["proposal1", "critique1", "proposal2", "critique2"]):
            result = COUNCIL.refine_candidate(
                {"title": "supplier quote comparison"}, tenant_id="tenant-a", silo_id="b2b",
                providers=providers, rounds=2
            )
        self.assertEqual(result["rounds"], 2)
        self.assertEqual(len(result["receipts"]), 2)
        self.assertEqual(result["status"], "REVIEW_PROPOSAL_ONLY")
        self.assertFalse(result["authorization"]["publish"])
        self.assertFalse(result["authorization"]["contact_buyer"])
        self.assertEqual(result["revenue_claim"], "NONE")
        self.assertEqual(result["tenant_id"], "tenant-a")

    def test_rejects_oversized_candidate(self):
        providers = [
            COUNCIL.Provider("a", "https://a.invalid/v1", "m1", "A"),
            COUNCIL.Provider("b", "https://b.invalid/v1", "m2", "B"),
        ]
        with self.assertRaises(COUNCIL.CouncilError):
            COUNCIL.refine_candidate({"data": "x" * 17000}, tenant_id="t", silo_id="b2b", providers=providers)


if __name__ == "__main__":
    unittest.main()
