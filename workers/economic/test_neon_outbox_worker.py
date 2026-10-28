import unittest
from neon_outbox_worker import config, receipt, deliver

def env(**overrides):
    x={
      "BECK_NEON_COMMERCE_ENABLED":"1",
      "NEON_DATABASE_URL":"postgresql://masked@neon.example/db?sslmode=require",
      "BECK_DELIVERY_ADAPTER_URL":"https://deliver.example.com/api/order",
      "BECK_DELIVERY_ALLOWED_HOST":"deliver.example.com",
      "BECK_DELIVERY_ADAPTER_TOKEN":"synthetic-test",
      "BECK_DELIVERY_ALLOWED_SILO":"mtg",
      "BECK_DELIVERY_IDEMPOTENCY_CONTRACT":"verified-v1",
      "GITHUB_RUN_ID":"123456",
    }
    x.update(overrides)
    return x

class NeonCloudContract(unittest.TestCase):
    def test_defaults_off(self):
        self.assertIsNone(config({}))
    def test_live_enabled_requires_all_inputs(self):
        with self.assertRaisesRegex(ValueError,"CONFIG_HOLD"):
            config({"BECK_NEON_COMMERCE_ENABLED":"1"})
    def test_tls_required(self):
        with self.assertRaisesRegex(ValueError,"TLS_MISSING"):
            config(env(NEON_DATABASE_URL="postgresql://masked@neon.example/db"))
    def test_unapproved_adapter_refused(self):
        with self.assertRaisesRegex(ValueError,"UNATTESTED"):
            config(env(BECK_DELIVERY_IDEMPOTENCY_CONTRACT="unknown"))
    def test_wrong_silo_refused(self):
        cfg=config(env())
        job={"delivery_key":"stripe_delivery:abc",
             "payload":{"silo_id":"adult","delivery_ref":"abc"}}
        with self.assertRaisesRegex(ValueError,"CROSS_SILO"):
            deliver(cfg,job,"trace-1")
    def test_http_and_private_host_refused(self):
        with self.assertRaisesRegex(ValueError,"ORIGIN_REFUSED"):
            config(env(BECK_DELIVERY_ADAPTER_URL="http://deliver.example.com/api/order"))
        with self.assertRaisesRegex(ValueError,"PRIVATE_DELIVERY_IP_REFUSED"):
            config(env(BECK_DELIVERY_ADAPTER_URL="https://127.0.0.1/deliver",
                       BECK_DELIVERY_ALLOWED_HOST="127.0.0.1"))
    def test_provider_receipt_is_not_email_send_ack(self):
        with self.assertRaisesRegex(ValueError,"NOT_ATTESTED"):
            receipt({"delivery_key":"k","status":"SENT","receipt_sha256":"a"*64},"k")
        with self.assertRaisesRegex(ValueError,"INVALID_HOLD"):
            receipt({"delivery_key":"k","status":"DELIVERED",
                    "buyer_delivery_verified":True,"receipt_sha256":"fake"},"k")
    def test_matching_buyer_receipt_shape(self):
        self.assertEqual(receipt({"delivery_key":"k","status":"DELIVERED",
            "buyer_delivery_verified":True,"receipt_sha256":"a"*64},"k"),"a"*64)
    def test_url_credentials_rejected(self):
        with self.assertRaisesRegex(ValueError,"ORIGIN_REFUSED"):
            config(env(BECK_DELIVERY_ADAPTER_URL="https://admin:password@deliver.example.com/api/order"))
    def test_redirect_refusal(self):
        from neon_outbox_worker import NoRedirect
        with self.assertRaisesRegex(ValueError,"REDIRECT_REFUSED"):
            NoRedirect().redirect_request(None,None,302,"Moved",{},"https://example.org/")
if __name__=="__main__": unittest.main()
