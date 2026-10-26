import unittest
from decimal import Decimal
from quote_compare import compare, norm_quote

def q(name, unit, freight="10.00", tax="0.00", fees="0.00", currency="NZD"):
    return {"supplier":name,"currency":currency,"items":[{"description":"Rugged tablet","quantity":2,"unit_price":unit}],
            "freight":freight,"tax":tax,"other_fees":fees}

class QuoteCompareTests(unittest.TestCase):
    def test_deterministic_full_total_and_ranking(self):
        result=compare([q("Supplier B","500"),q("Supplier A","450")])
        self.assertTrue(result["fully_comparable"])
        self.assertEqual(result["lowest_known_cost_supplier"],"Supplier A")
        self.assertEqual(result["quotes"][0]["known_cost_total"],"910.00")
    def test_missing_cost_never_claims_cheapest(self):
        result=compare([q("Known","10"),q("Unknown","20",freight=None)])
        self.assertFalse(result["fully_comparable"])
        self.assertIsNone(result["lowest_known_cost_supplier"])
        self.assertIn("missing cost fields",result["warning"])
    def test_currency_mismatch_blocks_ranking(self):
        result=compare([q("NZ","10",currency="NZD"),q("AU","10",currency="AUD")])
        self.assertFalse(result["fully_comparable"])
        self.assertIsNone(result["lowest_known_cost_supplier"])
    def test_negative_cost_rejected(self):
        with self.assertRaises(ValueError): norm_quote(q("Bad","-1"))
    def test_missing_item_price_preserved_as_unknown(self):
        out=norm_quote(q("Partial",None))
        self.assertIsNone(out["items"][0]["line_total"])
        self.assertFalse(out["total_complete"])
if __name__ == "__main__": unittest.main()
