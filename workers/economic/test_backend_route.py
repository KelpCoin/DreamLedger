import unittest
from backend_route import choose,proof,NEON_GATES,SUPABASE_GATES

class RouteTests(unittest.TestCase):
    def test_defaults_to_neon_but_holds(self):
        self.assertEqual(choose({}),("HOLD","PRIMARY_CUTOVER_EVIDENCE_UNATTESTED","neon"))
    def test_supabase_cannot_win_by_default(self):
        self.assertNotEqual(choose({})[0],"SUPABASE")
    def test_neon_requires_every_gate(self):
        for omitted in NEON_GATES:
            flags={k:"1" for k in NEON_GATES}
            flags.pop(omitted)
            self.assertEqual(choose(flags)[0],"HOLD")
        self.assertEqual(choose({k:"1" for k in NEON_GATES})[0],"NEON")
    def test_supabase_requires_explicit_override_and_all_gates(self):
        flags={k:"1" for k in SUPABASE_GATES}
        self.assertEqual(choose(flags)[0],"HOLD")
        flags["BECK_COMMERCE_PRIMARY"]="supabase"
        self.assertEqual(choose(flags)[0],"SUPABASE")
        for omitted in SUPABASE_GATES:
            not_ready=flags.copy();not_ready.pop(omitted)
            self.assertEqual(choose(not_ready)[0],"HOLD")
    def test_unknown_backend_refuses(self):
        self.assertEqual(choose({"BECK_COMMERCE_PRIMARY":"render"})[0],"HOLD")
        self.assertEqual(choose({"BECK_COMMERCE_PRIMARY":"both"})[0],"HOLD")
    def test_no_automatic_cross_database_fallback(self):
        p=proof({"BECK_COMMERCE_PRIMARY":"neon",
                 "BECK_SUPABASE_FALLBACK_APPROVED":"1"})
        self.assertEqual(p["selected_backend"],"HOLD")
        self.assertFalse(p["automatic_cross_database_failover"])
    def test_no_revenue_claim_even_when_flags_set(self):
        env={k:"1" for k in NEON_GATES}
        p=proof(env)
        self.assertEqual(p["selected_backend"],"NEON")
        self.assertFalse(p["production_cutover_approved_by_this_code"])
        self.assertFalse(p["payment_receipts_independently_verified"])
        self.assertIsNone(p["production_revenue_claimed_nzd"])
    def test_proof_digest(self):
        import hashlib,json
        p=proof({})
        core={k:v for k,v in p.items() if k!="sha256"}
        self.assertEqual(p["sha256"],hashlib.sha256(json.dumps(core,sort_keys=True,separators=(",",":"),ensure_ascii=True).encode()).hexdigest())
if __name__=="__main__":
    unittest.main()
