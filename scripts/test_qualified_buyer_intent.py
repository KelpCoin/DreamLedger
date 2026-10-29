"""Deterministic tests for the 777 qualified buyer intent gate."""
import unittest

from qualified_buyer_intent import classify_signal, deduplicate_signals, empty_batch_receipt


BASE = {
    "url": "https://example.com/buyer-request/123",
    "published_at": "2026-10-13T01:00:00Z",
}


class QualifiedBuyerIntentTests(unittest.TestCase):
    def test_generic_news_is_discovery_only_even_with_topic_keywords(self):
        signal = {
            **BASE,
            "title": "New API automation platform announced",
            "publisher": "Example News",
        }
        self.assertEqual(classify_signal(signal)["status"], "DISCOVERY_ONLY")

    def test_explicit_attributable_request_with_provenance_qualifies(self):
        signal = {
            **BASE,
            "buyer_attribution": "Named business buyer in source",
            "concrete_problem": "Their invoice exports fail reconciliation each week",
            "explicit_solution_request": "Requests a vendor/tool to validate and repair invoice exports",
        }
        self.assertEqual(classify_signal(signal)["status"], "QUALIFIED_BUYER_INTENT")

    def test_missing_url_or_timestamp_is_unknown(self):
        self.assertEqual(classify_signal({"title": "Need a tool"} )["status"], "UNKNOWN")

    def test_failed_source_is_unknown_not_zero_demand(self):
        self.assertEqual(classify_signal({"source_fetch_failed": True})["status"], "UNKNOWN")

    def test_duplicate_source_and_timestamp_is_idempotent(self):
        first = {**BASE, "title": "API automation"}
        duplicate = {**BASE, "title": "A different headline from the same URL"}
        self.assertEqual(len(deduplicate_signals([first, duplicate])), 1)

    def test_empty_batch_is_internal_noop_and_creates_no_public_artifact(self):
        receipt = empty_batch_receipt()
        self.assertEqual(receipt["status"], "NOOP_INTERNAL_ONLY")
        self.assertEqual(receipt["public_artifacts_created"], 0)
        self.assertEqual(receipt["qualified_intent_count"], 0)


    def test_777_cycle_uses_gate_and_has_no_generic_public_fallback(self):
        from pathlib import Path

        cycle = Path(__file__).with_name("777_cycle.py").read_text(encoding="utf-8")
        self.assertIn("from qualified_buyer_intent import classify_signal", cycle)
        self.assertIn('item.get("qualification_status") == "QUALIFIED_BUYER_INTENT"', cycle)
        self.assertIn('"public_artifacts_created": 0', cycle)
        self.assertNotIn("777-component-", cycle)
        self.assertNotIn("Agent Bridge capability map (catalogue candidates; settlement unverified)", cycle)


if __name__ == "__main__":
    unittest.main()
