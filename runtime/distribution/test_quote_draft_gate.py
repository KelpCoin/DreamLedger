import hashlib
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parent))
from quote_draft_gate import make_packet, validate_draft, save_packet, loopback_base, free_draft


def signal():
    return {'schema':'dreamledger.distribution.signal.v1','silo_id':'commerce_quotes',
            'platform':'REDDIT','offer':'FREE_QUOTE_WORKSHEET',
            'source':{'kind':'OWNED','url':'https://dreamledger.org/quote-comparison/',
                      'permission':'authorized','observed_at':'2026-10-22T00:00:00Z',
                      'signal_text':'Compare supplier quotes with missing terms visible.'}}


class DraftGateTests(unittest.TestCase):
    def test_private_free_only(self):
        r=make_packet(signal());self.assertEqual(r['status'],'DRAFT_REVIEW_REQUIRED')
        self.assertFalse(r['published']);self.assertFalse(r['payment_attribution_verified'])
        self.assertEqual(r['buyer_count'],0);self.assertEqual(r['payments_observed'],0)
        self.assertIn('PUBLISH',r['held_actions'])

    def test_reproducible_campaign(self):
        self.assertEqual(make_packet(signal())['campaign_ref'],make_packet(signal())['campaign_ref'])

    def test_no_cross_silo(self):
        x=signal();x['silo_id']='mtg_happyhomarid'
        with self.assertRaisesRegex(ValueError,'SILO_ISOLATION'):make_packet(x)

    def test_missing_permission(self):
        x=signal();x['source']['permission']='unknown'
        with self.assertRaisesRegex(ValueError,'SOURCE_AUTHORIZATION'):make_packet(x)

    def test_paid_checkout_held(self):
        x=signal();x['payment_link']='https://buy.stripe.com/example'
        with self.assertRaisesRegex(ValueError,'PAID_CHECKOUT'):make_packet(x)

    def test_payout_promise_rejected(self):
        with self.assertRaisesRegex(ValueError,'MISLEADING'):validate_draft(free_draft('REDDIT')+' paid report')

    def test_external_url_rejected(self):
        with self.assertRaisesRegex(ValueError,'UNAPPROVED'):validate_draft(free_draft('REDDIT')+' https://elsewhere.example')

    def test_cta_required(self):
        with self.assertRaisesRegex(ValueError,'MISLEADING'):validate_draft('A detailed useful worksheet comparison without a URL provided now.')

    def test_loopback_port_dynamic(self):
        self.assertEqual(loopback_base('http://127.0.0.1:1235'),'http://127.0.0.1:1235/v1')
        self.assertEqual(loopback_base('http://localhost:1234/v1'),'http://localhost:1234/v1')

    def test_no_public_lmstudio(self):
        for addr in ('https://example.com/v1','http://192.168.1.2:1234/v1','http://127.0.0.1:1234/notapi'):
            with self.assertRaisesRegex(ValueError,'LOOPBACK'):loopback_base(addr)

    def test_sha_check(self):
        with tempfile.TemporaryDirectory() as t:
            p=Path(t)/'draft.json';h=save_packet(make_packet(signal()),p)
            self.assertEqual(hashlib.sha256(p.read_bytes()).hexdigest(),h)
            self.assertEqual(p.with_suffix('.json.sha256').read_text().strip(),h)

    def test_synthetic_never_implies_buyers(self):
        x=signal();x['source']['kind']='SYNTHETIC_TEST';x['source']['permission']='unverified'
        self.assertEqual(make_packet(x)['buyer_count'],0)


if __name__=='__main__':unittest.main()
