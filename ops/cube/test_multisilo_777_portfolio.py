"""Contract tests for deterministic, fail-closed multi-silo expeditions."""
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from multisilo_777_portfolio import compile_portfolio, cents, expeditions


class MultiSiloPortfolioTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.put("BEC-PRIME/fulfillment/PRODUCT-FULFILLMENT-REGISTRY.json", {
            "entries": {"P": {"ready": True, "type": "automatic_service_fulfillment"}}})
        self.put("BEC-PRIME/catalog/offers/approved.json", {"approved": [
            {"product_id": "P", "offer_id": "OFFER-P", "price": 29,
             "silo": "mtg", "fulfillment_route": "manual_private_email_intake"}]})
        self.put("BEC-PRIME/catalog/products/P.json", {
            "id": "P", "silo": "mtg", "status": "held", "price": 29,
            "price_unit": "major", "checkout": {"mode": "disabled"}})
        self.put("BEC-PRIME/catalog/products/DREAMIEZ-TEST.json", {
            "id": "DREAMIEZ-TEST", "silo": "SILO_DREAMIEZ",
            "status": "published", "price": 500, "checkout": {"mode": "payment"},
            "commercial_truth": {"approval_required": False}})
        self.put("IP/DreamMeez/shadow-cosmetics-20261028.json", {"items": [{}, {}]})
        self.put("BEC-PRIME/catalog/truth-oracle/pricing.json", {"plans": [
            {"tier": "FREE"}, {"tier": "SIGNAL", "stripe_price_id": "price_example"}]})

    def put(self, path, obj):
        p = self.root / path
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps(obj), encoding="utf-8")

    def test_exactly_777_unique_candidates_balanced(self):
        x = expeditions()
        self.assertEqual(len(x), 777)
        self.assertEqual(len({e["expedition_id"] for e in x}), 777)
        counts = [sum(e["silo"] == silo for e in x) for silo in set(e["silo"] for e in x)]
        self.assertLessEqual(max(counts) - min(counts), 1)

    def test_all_candidates_are_hypotheses_and_blocked(self):
        for x in expeditions():
            self.assertEqual(x["status"], "RESEARCH_HYPOTHESIS_ONLY")
            self.assertEqual(x["commercial_actions"]["external_action"], "BLOCKED")
            self.assertFalse(x["commercial_actions"]["new_price"])
            self.assertEqual(x["gold_mode"], "HOLD")

    def test_major_minor_currency_not_guessed(self):
        self.assertEqual(cents(29, "major"), 2900)
        self.assertEqual(cents(2900, "minor"), 2900)
        self.assertIsNone(cents(5000, None))
        self.assertIsNone(cents("NaN", "major"))

    def test_held_conflict_and_manual_automation(self):
        rows = compile_portfolio(self.root)["products"]
        p = next(x for x in rows if x["product_id"] == "P")
        self.assertIn("REGISTRY_READY_BUT_PRODUCT_HELD", p["reasons"])
        self.assertIn("MANUAL_AUTOMATION_CONFLICT", p["reasons"])

    def test_avatar_originality_and_silo_isolation(self):
        r = compile_portfolio(self.root)
        p = next(x for x in r["products"] if x["silo"] == "avatar")
        self.assertIn("AVATAR_ARTWORK_PROVENANCE_UNVERIFIED", p["reasons"])
        self.assertIn("AVATAR_APPROVAL_GATE_MISSING", p["reasons"])
        self.assertEqual(r["avatar_shadow_candidate_count"], 2)

    def test_no_gold_without_provider_reconciliation(self):
        r = compile_portfolio(self.root)
        self.assertFalse(r["gold_mode"]["enabled"])
        self.assertEqual(r["gold_mode"]["graduated_skus"], [])
        self.assertEqual(r["economic_truth"]["verified_new_external_sales"], "NOT_ASSESSED")

    def test_deterministic_report(self):
        self.assertEqual(compile_portfolio(self.root), compile_portfolio(self.root))


if __name__ == "__main__":
    unittest.main()
