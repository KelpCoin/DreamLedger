import sys
from pathlib import Path
import unittest
sys.path.insert(0,str(Path(__file__).resolve().parent))
from lmstudio_copy_adapter import loopback_api,validate_copy,FREE_URL

class CopyAdapterTests(unittest.TestCase):
    def test_dynamic_port(self):
        self.assertEqual(loopback_api('http://127.0.0.1:1235'),'http://127.0.0.1:1235/v1')
        self.assertEqual(loopback_api('http://localhost:1234/v1'),'http://localhost:1234/v1')
    def test_reject_nonlocal_or_query(self):
        for a in ['https://example.com/v1','http://192.168.1.10:1234/v1','http://localhost:1234/v1?evil=1']:
            with self.assertRaisesRegex(ValueError,'LOCAL_API_ONLY'):loopback_api(a)
    def test_allow_useful_free_copy(self):
        c='Compare supplier quotes in a private browser worksheet; missing terms stay visible. Try it: '+FREE_URL
        self.assertEqual(validate_copy(c),c)
    def test_paid_claim_is_blocked(self):
        with self.assertRaisesRegex(ValueError,'UNAUTHORIZED'):validate_copy('Get your paid report with guaranteed automated delivery. '+FREE_URL)
    def test_extra_external_url_is_blocked(self):
        with self.assertRaisesRegex(ValueError,'UNAUTHORIZED'):validate_copy('Free quote comparison worksheet for businesses: '+FREE_URL+' https://elsewhere.example')

if __name__=='__main__':unittest.main()
