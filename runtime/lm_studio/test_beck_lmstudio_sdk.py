import unittest
from types import SimpleNamespace
from unittest.mock import patch
import sys

from beck_lmstudio_sdk import ALLOWED, FIELDS, classify_with_sdk, cortex_act

class SDKAdapterTests(unittest.TestCase):
    def test_schema_fields_and_enums_are_defined(self):
        self.assertEqual(len(FIELDS), 10)
        self.assertIn("actively_seeking", ALLOWED["5_BUYING_INTENT"])

    def test_missing_sdk_is_explicit(self):
        with patch.dict(sys.modules, {"lmstudio": None}):
            from beck_lmstudio_sdk import _sdk
            with self.assertRaisesRegex(RuntimeError, "SDK_NOT_INSTALLED"):
                _sdk()

    def test_structured_prediction_and_null_cost(self):
        parsed = {field: "value" for field in FIELDS}
        parsed.update({
            "2_FREQUENCY": "recurring", "3_URGENCY": "costly",
            "5_BUYING_INTENT": "actively_seeking", "6_MONEY_SIGNAL": "unknown",
            "9_STATUS_BUCKET": "WORKING_MONETIZABLE", "10_NEXT_ACTION": "monitor"
        })
        prediction = SimpleNamespace(parsed=parsed, stats=SimpleNamespace(
            prompt_tokens_count=22, predicted_tokens_count=13, time_to_first_token_sec=0.2
        ), model_info=SimpleNamespace(display_name="test-model"))
        model = SimpleNamespace(respond=lambda *args, **kwargs: prediction)
        lms = SimpleNamespace(llm=lambda *args, **kwargs: model)
        with patch("beck_lmstudio_sdk._sdk", return_value=lms):
            result, meta = classify_with_sdk("test")
        self.assertEqual(result, parsed)
        self.assertEqual(meta["input_tokens"], 22)
        self.assertIsNone(meta["estimated_cost"])
        self.assertEqual(meta["provider"], "lmstudio-python-sdk")

    def test_invalid_enum_fails_closed(self):
        parsed = {field: "value" for field in FIELDS}
        parsed.update({
            "2_FREQUENCY": "bogus", "3_URGENCY": "costly",
            "5_BUYING_INTENT": "actively_seeking", "6_MONEY_SIGNAL": "unknown",
            "9_STATUS_BUCKET": "WORKING_MONETIZABLE", "10_NEXT_ACTION": "monitor"
        })
        prediction = SimpleNamespace(parsed=parsed, stats=None, model_info=None)
        lms = SimpleNamespace(llm=lambda *args, **kwargs: SimpleNamespace(
            respond=lambda *args, **kwargs: prediction))
        with patch("beck_lmstudio_sdk._sdk", return_value=lms):
            with self.assertRaisesRegex(ValueError, "INVALID_2_FREQUENCY"):
                classify_with_sdk("test")

    def test_act_rejects_unapproved_tools(self):
        def shell(command: str):
            return command
        with self.assertRaisesRegex(ValueError, "TOOL_NOT_ALLOWLISTED"):
            cortex_act("do task", [shell])

if __name__ == "__main__":
    unittest.main()
