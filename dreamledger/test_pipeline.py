import json
import tempfile
import unittest
from datetime import date
from pathlib import Path
from unittest.mock import patch

from . import draft, fulfil, ledger, qualify


class QualificationTests(unittest.TestCase):
    def test_provider_post_fails_closed(self):
        result = qualify.evaluate(thread_text="[For Hire] I am available for Shopify builds at $499", thread_url="https://example.com/thread", buyer_handle="seller", last_buyer_activity=date.today().isoformat(), thread_kind="for_hire")
        self.assertEqual(result["verdict"], "FAIL")
        self.assertEqual(result["reason"], "provider_post_detected")

    def test_fresh_buyer_implementation_passes(self):
        text = "I need someone to build a Shopify to Google Sheets to Slack workflow. Budget $499. Looking to hire this week."
        result = qualify.evaluate(thread_text=text, thread_url="https://example.com/thread", buyer_handle="buyer123", last_buyer_activity=date.today().isoformat(), thread_kind="hiring")
        self.assertEqual(result["verdict"], "PASS")
        self.assertEqual(result["points_passed"], 9)
        self.assertEqual(result["points"]["6_scope_fit"]["recommended_sku"], "N8N-IMPLEMENT-001")

    def test_missing_freshness_fails(self):
        text = "Need to build an automation. Budget $499."
        result = qualify.evaluate(thread_text=text, thread_url="https://example.com/thread", buyer_handle="buyer123", last_buyer_activity=None, thread_kind="hiring")
        self.assertEqual(result["verdict"], "FAIL")
        self.assertIn("7_freshness", result["points_failed"])


class DraftTests(unittest.TestCase):
    def test_draft_is_not_approved_or_sent(self):
        result = draft.draft(buyer_handle="buyer", problem_summary="a lead routing workflow", scope_kind="implementation", price_nzd=499)
        self.assertEqual(result["price_nzd"], 499)
        self.assertFalse(result["approved"])
        self.assertFalse(result["sent"])
        self.assertIn("NZ$499", result["body"])


class LedgerTests(unittest.TestCase):
    def test_hash_chain_and_fulfilment(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            ledger_path = root / "events.jsonl"
            fulfil_dir = root / "fulfilments"
            with patch.object(ledger, "LEDGER", ledger_path), patch.object(fulfil, "FULFILMENT_DIR", fulfil_dir):
                record = fulfil.record_fulfilment(order_id="pi_test", sku="TEST-001", amount_cents=5000, currency="NZD", buyer_reference="buyer-ref", deliverable_text="delivered", delivery_channel="email", time_taken_minutes=30)
                self.assertTrue((fulfil_dir / "pi_test.json").exists())
                self.assertEqual(record["amount_cents"], 5000)
                self.assertTrue(ledger.verify()["ok"])
                entries = [json.loads(x) for x in ledger_path.read_text().splitlines() if x.strip()]
                self.assertEqual(entries[0]["kind"], "fulfilment.completed")


if __name__ == "__main__":
    unittest.main()
