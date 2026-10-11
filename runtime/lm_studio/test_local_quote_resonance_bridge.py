import importlib.util
import unittest
from pathlib import Path

MODULE = Path(__file__).with_name("local_quote_resonance_bridge.py")
SPEC = importlib.util.spec_from_file_location("local_quote_resonance_bridge", MODULE)
BRIDGE = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(BRIDGE)


def valid_quote():
    return {
        "supplier": "Example Supplier",
        "quote_reference": None,
        "currency": "NZD",
        "line_items": [{
            "description": "Widget",
            "quantity": 2,
            "unit": "each",
            "unit_price": 10.0,
            "line_total": 20.0,
        }],
        "subtotal": 20.0,
        "tax": None,
        "total": 20.0,
        "validity_date": None,
        "payment_terms": None,
        "uncertainties": ["Tax not stated"],
    }


class QuoteBridgeValidationTests(unittest.TestCase):
    def test_accepts_valid_structured_quote(self):
        BRIDGE.validate(valid_quote())

    def test_rejects_missing_top_level_key(self):
        value = valid_quote()
        del value["total"]
        with self.assertRaisesRegex(ValueError, "OUTPUT_SCHEMA_KEYS_MISMATCH"):
            BRIDGE.validate(value)

    def test_rejects_extra_top_level_key(self):
        value = valid_quote()
        value["buyer"] = "invented"
        with self.assertRaisesRegex(ValueError, "OUTPUT_SCHEMA_KEYS_MISMATCH"):
            BRIDGE.validate(value)

    def test_rejects_line_item_without_description(self):
        value = valid_quote()
        value["line_items"][0]["description"] = ""
        with self.assertRaisesRegex(ValueError, "LINE_ITEM_DESCRIPTION_MISSING"):
            BRIDGE.validate(value)

    def test_rejects_boolean_as_numeric_value(self):
        value = valid_quote()
        value["total"] = True
        with self.assertRaisesRegex(ValueError, "QUOTE_TOTAL_FIELD_INVALID"):
            BRIDGE.validate(value)

    def test_sha256_is_deterministic(self):
        self.assertEqual(BRIDGE.digest(b"quote"), BRIDGE.digest(b"quote"))
        self.assertNotEqual(BRIDGE.digest(b"quote"), BRIDGE.digest(b"other"))


if __name__ == "__main__":
    unittest.main()
