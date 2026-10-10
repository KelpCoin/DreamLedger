import unittest
from datetime import datetime, timezone
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).parent))
from policy import evaluate_intent

NOW = datetime(2026, 10, 9, 12, 0, tzinfo=timezone.utc)

class BeckPolicyTests(unittest.TestCase):
    def setUp(self):
        self.contract = {'contract_id':'dreamledger.beck.bounded-execution.v1','status':'ACTIVE','allowed_action_types':['READ_TEST_FIXTURE'],'allowed_targets':{'READ_TEST_FIXTURE':['fixture:demo']},'limits':{'max_attempts':1,'max_duration_seconds':30,'max_api_calls':0,'max_spend_minor_units':0,'max_payload_bytes':1024}}
        self.intent = {'intent_id':'intent-test-0001','action_type':'READ_TEST_FIXTURE','target':'fixture:demo','issued_at':'2026-10-09T11:59:00Z','idempotency_key':'idem-test-0001','payload':{'mode':'test'},'limits':{'max_attempts':1,'max_duration_seconds':10,'max_api_calls':0,'max_spend_minor_units':0}}
        self.authority = {'state':'APPROVED','reference':'gate-test-0001','intent_id':self.intent['intent_id'],'action_type':self.intent['action_type'],'target':self.intent['target'],'expires_at':'2026-10-09T12:05:00Z'}
    def test_valid_intent_allowed(self):
        self.assertEqual(evaluate_intent(self.intent,self.authority,self.contract,now=NOW)['decision'],'ALLOW')
    def test_proposed_contract_denied(self):
        self.contract['status']='PROPOSED'
        self.assertEqual(evaluate_intent(self.intent,self.authority,self.contract,now=NOW)['decision'],'DENY')
    def test_missing_authority_denied(self):
        self.assertIn('AUTHORITY_MISSING',evaluate_intent(self.intent,None,self.contract,now=NOW)['reason_codes'])
    def test_expired_authority_denied(self):
        self.authority['expires_at']='2026-10-09T11:59:59Z'
        self.assertIn('AUTHORITY_EXPIRED',evaluate_intent(self.intent,self.authority,self.contract,now=NOW)['reason_codes'])
    def test_scope_mismatch_denied(self):
        self.authority['target']='fixture:other'
        self.assertIn('AUTHORITY_SCOPE_MISMATCH',evaluate_intent(self.intent,self.authority,self.contract,now=NOW)['reason_codes'])
    def test_unlisted_action_denied(self):
        self.intent['action_type']='DELETE_PRODUCTION'
        self.assertIn('ACTION_NOT_ALLOWLISTED',evaluate_intent(self.intent,self.authority,self.contract,now=NOW)['reason_codes'])
    def test_out_of_scope_target_denied(self):
        self.intent['target']='production:database'
        self.assertIn('TARGET_OUT_OF_SCOPE',evaluate_intent(self.intent,self.authority,self.contract,now=NOW)['reason_codes'])
    def test_budget_overrun_denied(self):
        self.intent['limits']['max_duration_seconds']=31
        self.assertIn('RESOURCE_LIMIT_EXCEEDED',evaluate_intent(self.intent,self.authority,self.contract,now=NOW)['reason_codes'])
    def test_missing_intent_field_denied(self):
        del self.intent['idempotency_key']
        self.assertIn('INVALID_INTENT',evaluate_intent(self.intent,self.authority,self.contract,now=NOW)['reason_codes'])
    def test_future_intent_denied(self):
        self.intent['issued_at']='2026-10-09T12:00:01Z'
        self.assertIn('INTENT_FROM_FUTURE',evaluate_intent(self.intent,self.authority,self.contract,now=NOW)['reason_codes'])
    def test_idempotency_conflict_denied(self):
        self.assertIn('IDEMPOTENCY_CONFLICT',evaluate_intent(self.intent,self.authority,self.contract,now=NOW,prior_idempotency={'idem-test-0001':'different-fingerprint'})['reason_codes'])
    def test_payload_size_overrun_denied(self):
        self.contract['limits']['max_payload_bytes']=2
        self.assertIn('RESOURCE_LIMIT_EXCEEDED',evaluate_intent(self.intent,self.authority,self.contract,now=NOW)['reason_codes'])

if __name__ == '__main__':
    unittest.main()
