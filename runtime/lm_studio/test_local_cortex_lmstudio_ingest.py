import unittest
from unittest.mock import patch
import local_cortex_lmstudio_ingest as ingest


def base_audit():
    return {
        "1_PAIN": "Signal requires classification",
        "2_FREQUENCY": "isolated",
        "3_URGENCY": "nuisance",
        "4_CURRENT_WORKAROUND": "Unknown",
        "5_BUYING_INTENT": "none",
        "6_MONEY_SIGNAL": "unknown",
        "7_BUYER": "Unknown buyer role",
        "8_PRODUCT_OPPORTUNITY": "UNMATCHED",
        "9_STATUS_BUCKET": "HUMAN_GATE_CANDIDATE",
        "10_NEXT_ACTION": "monitor",
    }


class LocalCortexIngestTests(unittest.TestCase):
    def test_fallback_never_maps_supplier_quote_to_held_sku(self):
        signal = {
            "id": "test-signal",
            "title": "Supplier quotation issue",
            "text": "We need a supplier quote because the current process is slow.",
            "url": "https://example.invalid/synthetic-fixture",
        }
        result = ingest.fallback(signal, "MODEL_OFFLINE")
        self.assertEqual(result["8_PRODUCT_OPPORTUNITY"], "UNMATCHED")
        self.assertEqual(result["9_STATUS_BUCKET"], "HUMAN_GATE_CANDIDATE")
        self.assertNotEqual(result["10_NEXT_ACTION"], "paid_offer_candidate")

    def test_fallback_requires_stronger_evidence_for_paid_candidate(self):
        signal = {
            "title": "Sample buyer request",
            "text": "We are looking for a tool and have a budget of NZ$500; ready to purchase.",
            "url": "",
        }
        result = ingest.fallback(signal, "MODEL_OFFLINE")
        self.assertEqual(result["6_MONEY_SIGNAL"], "explicit_budget")
        self.assertEqual(result["5_BUYING_INTENT"], "actively_seeking")
        self.assertEqual(result["10_NEXT_ACTION"], "paid_offer_candidate")
        self.assertEqual(result["8_PRODUCT_OPPORTUNITY"], "UNMATCHED")

    def test_bad_model_enum_falls_back_without_exposing_raw_exception(self):
        signal = {"title": "Example", "text": "slow manual process", "url": ""}
        bad = base_audit()
        bad["2_FREQUENCY"] = "WIDESPREAD-ish"
        with patch.object(ingest, "classify_with_sdk", return_value=(bad, {"provider": "mock"})):
            result, telemetry = ingest.classify(signal)
        self.assertIn(result["8_PRODUCT_OPPORTUNITY"], {"UNMATCHED"})
        self.assertTrue(telemetry["fallback"])
        self.assertEqual(telemetry["provider"], "cortex-heuristic")
        self.assertNotIn("exception", str(telemetry).lower())

    def test_missing_and_extra_fields_are_rejected(self):
        signal = {"title": "Example", "text": "budget unknown", "url": ""}
        malformed = base_audit()
        malformed["EXTRA"] = "must not pass"
        with patch.object(ingest, "classify_with_sdk", return_value=(malformed, {})):
            result, telemetry = ingest.classify(signal)
        self.assertTrue(telemetry["fallback"])
        self.assertEqual(result["9_STATUS_BUCKET"], "HUMAN_GATE_CANDIDATE")
        self.assertEqual(result["8_PRODUCT_OPPORTUNITY"], "UNMATCHED")

    def test_checkout_never_opens_without_approved_offer(self):
        decision = ingest.checkout_decision({"decision": "PASS"}, None)
        self.assertEqual(decision["status"], "HUMAN_GATE_REQUIRED")
        self.assertEqual(decision["reason"], "NO_APPROVED_OFFER")

    def test_checkout_still_requires_explicit_approved_offer_flags(self):
        candidate = {
            "offer_id": "OFFER-TEST",
            "approval_required": True,
            "checkout_available": True,
            "payment_link_url": "https://buy.stripe.com/example",
        }
        decision = ingest.checkout_decision({"decision": "PASS"}, candidate)
        self.assertEqual(decision["status"], "HUMAN_GATE_REQUIRED")
        candidate["approval_required"] = False
        decision = ingest.checkout_decision({"decision": "PASS"}, candidate)
        self.assertEqual(decision["status"], "CHECKOUT_CANDIDATE")


if __name__ == "__main__":
    unittest.main()
