import unittest
from economic_proof_gate import evaluate

class GateTests(unittest.TestCase):
    def setUp(self):
        self.e = dict(payment_id="pi_example",external_buyer_verified=True,settled=True,sku="TEST",delivery_sha256="a"*64,direct_cost_nzd="2",amount_nzd="29",operator_minutes=1)
    def test_complete_still_provisional(self):
        self.assertEqual(evaluate(self.e)["verdict"],"PROVISIONAL")
    def test_unpaid_hold(self):
        self.e["settled"]=False
        self.assertEqual(evaluate(self.e)["verdict"],"HOLD")
    def test_missing_proof_hold(self):
        del self.e["delivery_sha256"]
        self.assertEqual(evaluate(self.e)["verdict"],"HOLD")
    def test_bad_economics_hold(self):
        self.e["amount_nzd"]="NaN"
        self.assertEqual(evaluate(self.e)["verdict"],"HOLD")
if __name__ == "__main__": unittest.main()
