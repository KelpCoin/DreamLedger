"""Regression tests for the commercial payment-only truth gate (no dependencies)."""
from __future__ import annotations
import importlib.util
import sqlite3
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "ops" / "commercial" / "money_pipeline.py"
spec = importlib.util.spec_from_file_location("money_pipeline_truth_test", SCRIPT)
money = importlib.util.module_from_spec(spec)
spec.loader.exec_module(money)


class PaymentTruthGateTests(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.TemporaryDirectory()
        self.conn = sqlite3.connect(str(Path(self.dir.name) / "orders.sqlite3"))
        self.conn.row_factory = sqlite3.Row
        money.init_db(self.conn)

    def tearDown(self):
        self.conn.close()
        self.dir.cleanup()

    @staticmethod
    def event(livemode=True):
        return {
            "id": "evt_live_example",
            "type": "checkout.session.completed",
            "livemode": livemode,
            "dreamledger_external_buyer": True,
            "data": {"object": {
                "id": "cs_example",
                "object": "checkout.session",
                "payment_status": "paid",
                "amount_total": 2900,
                "currency": "nzd",
                "livemode": livemode,
                "metadata": {"offer_id": "OFFER-CMD-DIAG-29-NZD"}
            }}
        }

    def test_unverified_signature_rejected(self):
        with self.assertRaisesRegex(ValueError, "unverified payload"):
            money.ingest_verified_payment(self.conn, self.event(), signature_verified=False)
        self.assertEqual(self.conn.execute("SELECT COUNT(*) FROM commercial_payments").fetchone()[0], 0)

    def test_external_flag_is_never_sufficient(self):
        result = money.ingest_verified_payment(self.conn, self.event(True), signature_verified=True)
        self.assertFalse(result["counts_as_verified_external_revenue"])
        self.assertEqual(result["economic_state"], "PAYMENT_ONLY_AWAITING_FULFILLMENT_PROOF")
        self.assertEqual(self.conn.execute(
            "SELECT SUM(counts_as_verified_external_revenue) FROM commercial_economic_events"
        ).fetchone()[0], 0)
        duplicate = money.ingest_verified_payment(self.conn, self.event(True), signature_verified=True)
        self.assertTrue(duplicate["idempotent"])
        self.assertEqual(self.conn.execute("SELECT COUNT(*) FROM commercial_payments").fetchone()[0], 1)

    def test_fixture_external_override_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            fixture = Path(directory) / "payment.json"
            fixture.write_text('{"id":"evt_fake"}', encoding="utf-8")
            completed = subprocess.run(
                [sys.executable, str(SCRIPT), "ingest-fixture", str(fixture), "--external"],
                cwd=directory, capture_output=True, text=True
            )
            self.assertNotEqual(completed.returncode, 0)
            self.assertIn("cannot certify revenue", completed.stderr)


if __name__ == "__main__":
    unittest.main()
