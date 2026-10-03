import json,tempfile,unittest,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from economic_silo_factory import MAX_CELLS,SCHEMA,generate_cells,write_outputs

def src():
    return {"generated_at_utc":"2026-10-04T00:00:00Z","base_commit":"fc1cc3cbf79bc1b0f2662fe82978180b1ca8eaf0","truth_boundary":{"verified_external_revenue_nzd":0,"settled_external_payments":0,"independent_external_buyers":0,"verified_economic_outcomes":0},"observed_capabilities":[["BEC-PRIME-ARCHITECTURE","architecture_audit","preflight"],["BEC-PRIME-AGENT-COMMERCE","agentic_commerce_architecture","readiness"]],"observed_existing_offers":[["OFFER-BEC-PRIME-ARCHITECTURE-AUDIT-002","APPROVED",True,"awaiting_first_payment","commerce"],["OFFER-BEC-PRIME-AGENT-READINESS-001","APPROVED",True,"awaiting_first_payment","commerce"]],"existing_fulfillment_substrate":{"quote_intake":True,"quote_fulfillment":True,"economic_fulfillment_worker":True,"evidence_hashing":True},"offer_fulfillment_map":{"OFFER-BEC-PRIME-ARCHITECTURE-AUDIT-002":{"economic_fulfillment_worker":True},"OFFER-BEC-PRIME-AGENT-READINESS-001":{"economic_fulfillment_worker":True}},"payment_path_observed":True,"evidence_path_observed":True,"commercial_boundary_observed":True,"observed_demand_signals":[]}

class T(unittest.TestCase):
    def test_deterministic_bounded(self):
        a=generate_cells(src(),MAX_CELLS);self.assertEqual(a,generate_cells(src(),MAX_CELLS));self.assertLessEqual(len(a),MAX_CELLS);self.assertGreater(len(a),0)
    def test_ready_does_not_mean_demand_or_replication(self):
        r=[x for x in generate_cells(src(),1000) if x["ECONOMIC_STATE"]=="READY_FOR_PAYMENT"];self.assertTrue(r);self.assertTrue(all(x["DEMAND_SIGNAL"] is None for x in r));self.assertTrue(all(not x["REPLICATION_ELIGIBLE"] for x in r))
    def test_payment_missing_blocks(self):
        s=src();s["payment_path_observed"]=False;c=generate_cells(s,100);self.assertTrue(all(x["ECONOMIC_STATE"]=="BLOCKED" and x["BLOCKER"]=="PAYMENT_PATH_UNOBSERVED" for x in c))
    def test_no_fake_truth(self):
        p=json.dumps(generate_cells(src(),100));self.assertNotIn("VERIFIED_EXTERNAL_REVENUE",p);self.assertNotIn("PAYMENT_SETTLED",p);self.assertNotIn("ECONOMIC_OUTCOME_VERIFIED",p)
    def test_outputs_and_hash(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);sp=root/"s.json";sp.write_text(json.dumps(src()),encoding="utf-8");r=write_outputs(sp,root/"out",100)
            for p in r["paths"].values():self.assertTrue(Path(p).exists());json.loads(Path(p).read_text())
            proof=json.loads((root/"out"/"ECONOMIC-SILO-FACTORY-PROOF-2026-10-04.json").read_text());self.assertEqual(proof["schema"],SCHEMA+"/proof");self.assertEqual(len(proof["catalog_sha256"]),64)
if __name__=="__main__":unittest.main()
