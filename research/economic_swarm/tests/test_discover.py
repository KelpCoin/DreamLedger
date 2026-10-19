import unittest
import discover

class DiscoveryTests(unittest.TestCase):
    def test_dedup_hash_is_stable(self):
        self.assertEqual(discover.digest('https://example.com'), discover.digest('https://example.com'))

    def test_unverified_component_cannot_marry(self):
        self.assertEqual(discover.make_marriages([{'id': 'a', 'status': 'CANDIDATE'}]), [])

    def test_verified_pair_is_proposal_only(self):
        base = {'status': 'VERIFIED', 'verified_external_outcomes': 1, 'evidence_ref': 'proof://immutable-1', 'success_definition': 'settled payment plus delivery'}
        result = discover.make_marriages([{**base, 'id': 'a'}, {**base, 'id': 'b'}])
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]['status'], 'PROPOSAL_ONLY')
        self.assertEqual(result[0]['resource_cap']['max_cost_nzd'], 0)

    def test_verified_component_requires_all_evidence_fields(self):
        self.assertFalse(discover.eligible_component({'status': 'VERIFIED', 'verified_external_outcomes': 1}))

if __name__ == '__main__':
    unittest.main()
