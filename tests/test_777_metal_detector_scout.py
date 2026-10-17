import importlib.util
import pathlib
import unittest

SCRIPT = pathlib.Path(__file__).resolve().parents[1] / "ops" / "demand" / "777-metal-detector-scout.py"
SPEC = importlib.util.spec_from_file_location("metal_detector_scout", SCRIPT)
SCOUT = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(SCOUT)


class MetalDetectorScoutTests(unittest.TestCase):
    def test_hash_is_stable_for_object_key_order(self):
        self.assertEqual(
            SCOUT.sha256(SCOUT.canonical_json({"b": 2, "a": 1})),
            SCOUT.sha256(SCOUT.canonical_json({"a": 1, "b": 2})),
        )

    def test_all_array_items_are_preserved(self):
        payload = [{"id": 1}, {"id": 2}, {"id": 3}]
        self.assertEqual(SCOUT.extract_items("test", payload), payload)

    def test_known_wrappers_are_unwrapped_without_filtering(self):
        payload = {"data": [{"id": 1}, {"id": 2}]}
        self.assertEqual(SCOUT.extract_items("test", payload), payload["data"])

    def test_unknown_object_is_preserved_not_dropped(self):
        payload = {"unexpected": "shape"}
        self.assertEqual(SCOUT.extract_items("test", payload), [payload])

    def test_url_extraction_is_bounded_to_http_urls(self):
        self.assertEqual(SCOUT.item_url({"url": "https://example.com/x"}), "https://example.com/x")
        self.assertIsNone(SCOUT.item_url({"url": "javascript:alert(1)"}))

    def test_migration_preserves_raw_find_and_uses_100_point_rubric(self):
        migration = (pathlib.Path(__file__).resolve().parents[1] / "supabase" / "migrations" / "20261013090000_777_metal_detector_scout.sql").read_text()
        self.assertIn("raw_payload jsonb not null", migration)
        self.assertIn("revenue_score integer not null check (revenue_score between 0 and 40)", migration)
        self.assertIn("reuse_score integer not null check (reuse_score between 0 and 30)", migration)
        self.assertIn("leverage_score integer not null check (leverage_score between 0 and 20)", migration)
        self.assertIn("novelty_score integer not null check (novelty_score between 0 and 10)", migration)
        self.assertIn("evidence_signature text", migration)
        self.assertIn("economic_ledger", migration)

    def test_no_network_dry_run_is_safe(self):
        import os
        old = os.environ.get("SCOUT_DRY_RUN")
        os.environ["SCOUT_DRY_RUN"] = "1"
        try:
            self.assertEqual(SCOUT.main(), 0)
        finally:
            if old is None:
                os.environ.pop("SCOUT_DRY_RUN", None)
            else:
                os.environ["SCOUT_DRY_RUN"] = old


if __name__ == "__main__":
    unittest.main()
