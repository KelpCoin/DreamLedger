import sys
from pathlib import Path
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from feed_diff import FeedValidationError, compare_csv_texts

class FeedDiffTests(unittest.TestCase):
    def test_price_change_new_and_removed(self):
        result = compare_csv_texts("sku,price,currency\nA,10,NZD\nB,2,NZD\n", "sku,price,currency\nA,12,NZD\nC,5,NZD\n")
        states = {row["sku"]: row["status"] for row in result["rows"]}
        self.assertEqual(states, {"A":"PRICE_CHANGED", "B":"REMOVED_SKU", "C":"NEW_SKU"})
        self.assertEqual(next(row for row in result["rows"] if row["sku"] == "A")["delta_percent"], "20.00")

    def test_duplicate_sku_flagged_not_merged(self):
        result = compare_csv_texts("sku,price,currency\nA,10,NZD\nA,11,NZD\n", "sku,price,currency\nA,12,NZD\n")
        self.assertIn("A", result["duplicate_skus"])
        self.assertEqual(result["rows"][0]["status"], "DUPLICATE_SKU_REVIEW")
        self.assertEqual(result["status"], "REVIEW_REQUIRED")

    def test_currency_change_suppresses_delta(self):
        result = compare_csv_texts("sku,price,currency\nA,10,NZD\n", "sku,price,currency\nA,9,USD\n")
        row = result["rows"][0]
        self.assertEqual(row["status"], "CURRENCY_CHANGED_REVIEW")
        self.assertIsNone(row["delta"])

    def test_zero_baseline_suppresses_percent(self):
        result = compare_csv_texts("sku,price,currency\nA,0,NZD\n", "sku,price,currency\nA,1,NZD\n")
        self.assertIsNone(result["rows"][0]["delta_percent"])

    def test_rejects_blank_sku_and_invalid_price(self):
        with self.assertRaises(FeedValidationError):
            compare_csv_texts("sku,price,currency\n,1,NZD\n", "sku,price,currency\nA,1,NZD\n")
        with self.assertRaises(FeedValidationError):
            compare_csv_texts("sku,price,currency\nA,wat,NZD\n", "sku,price,currency\nA,1,NZD\n")

    def test_rejects_oversize_and_missing_fields(self):
        with self.assertRaises(FeedValidationError):
            compare_csv_texts("sku,price,currency\nA,1,NZD\n", "sku,price,currency\nA,1,NZD\n", max_input_bytes=5)
        with self.assertRaises(FeedValidationError):
            compare_csv_texts("sku,price\nA,1\n", "sku,price,currency\nA,1,NZD\n")

    def test_comparison_key_is_deterministic(self):
        a = compare_csv_texts("sku,price,currency\nA,1,NZD\n", "sku,price,currency\nA,2,NZD\n")
        b = compare_csv_texts("sku,price,currency\nA,1,NZD\n", "sku,price,currency\nA,2,NZD\n")
        self.assertEqual(a["comparison_idempotency_key"], b["comparison_idempotency_key"])

if __name__ == "__main__":
    unittest.main()
