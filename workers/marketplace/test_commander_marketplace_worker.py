"""Offline credential-boundary and delivery-integrity tests. No provider calls."""
import importlib.util
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

SOURCE=Path(__file__).with_name("commander_marketplace_worker.py")


class Reply:
    def __init__(self,payload):
        self.payload=payload
    def __enter__(self):
        return self
    def __exit__(self,*args):
        return False
    def read(self,*args):
        return self.payload


class CommanderWorkerSecurityTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.env=patch.dict(os.environ,{
            "SUPABASE_URL":"https://db.example.supabase.co",
            "SUPABASE_SERVICE_ROLE_KEY":"synthetic-supabase-service-role",
            "CLOUD_MODEL_API_URL":"https://model.example/v1/chat/completions",
            "CLOUD_MODEL_API_KEY":"synthetic-cloud-model-key",
            "CLOUD_MODEL_NAME":"approved-test-model",
            "BEC_WORKER_ROOT":self.tmp.name
        })
        self.env.start()
        spec=importlib.util.spec_from_file_location("commander_worker_under_test",SOURCE)
        self.worker=importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.worker)

    def tearDown(self):
        self.env.stop()
        self.tmp.cleanup()

    def test_model_request_never_forwards_database_credentials(self):
        requests=[]
        payload={"choices":[{"message":{"content":"{}"}}]}
        def fake_open(request,timeout=None):
            requests.append((request,timeout))
            return Reply(json.dumps(payload).encode())
        with patch.object(self.worker.urllib.request,"urlopen",side_effect=fake_open):
            self.assertEqual(self.worker.model_request({"model":"approved-test-model"}),payload)
        self.assertEqual(len(requests),1)
        req,timeout=requests[0]
        self.assertEqual(timeout,25)
        self.assertEqual(req.get_header("Authorization"),"Bearer synthetic-cloud-model-key")
        headers=str(req.header_items())
        self.assertNotIn("synthetic-supabase-service-role",headers)
        self.assertNotIn("apikey",headers.lower())
        self.assertEqual(req.get_method(),"POST")

    def test_database_request_never_forwards_model_credentials(self):
        requests=[]
        def fake_open(request,timeout=None):
            requests.append(request)
            return Reply(b'{"ok":true}')
        with patch.object(self.worker.urllib.request,"urlopen",side_effect=fake_open):
            self.worker.req("https://db.example.supabase.co/rest/v1/rpc/example","POST",{})
        headers=str(requests[0].header_items())
        self.assertIn("synthetic-supabase-service-role",headers)
        self.assertNotIn("synthetic-cloud-model-key",headers)

    def test_unconfigured_or_untrusted_model_fails_without_network(self):
        for url in ("http://127.0.0.1:1234/v1/chat/completions",
                    "https://127.0.0.1/v1/chat/completions",
                    "https://192.168.1.2/v1/chat/completions",
                    "https://localhost/v1/chat/completions",
                    "https://model.local/v1/chat/completions",
                    "https://user:pass@model.example/v1/chat/completions"):
            with self.subTest(url=url),patch.dict(os.environ,{"CLOUD_MODEL_API_URL":url}),patch.object(self.worker.urllib.request,"urlopen") as opened:
                with self.assertRaisesRegex(RuntimeError,"CLOUD_MODEL_ENDPOINT_NOT_APPROVED"):
                    self.worker.model_request({})
                opened.assert_not_called()
        with patch.dict(os.environ,{"CLOUD_MODEL_API_KEY":""}),patch.object(self.worker.urllib.request,"urlopen") as opened:
            with self.assertRaisesRegex(RuntimeError,"CLOUD_MODEL_NOT_CONFIGURED"):
                self.worker.model_request({})
            opened.assert_not_called()

    def test_model_errors_do_not_leak_provider_data_or_produce_fake_report(self):
        with patch.object(self.worker.urllib.request,"urlopen",side_effect=ValueError("private-provider-error")):
            with self.assertRaisesRegex(RuntimeError,"^CLOUD_MODEL_REQUEST_FAILED$"):
                self.worker.model_request({})
        bad={"choices":[{"message":{"content":json.dumps({
            "executive_summary":"too short",
            "overall_score_0_to_100":0,
            "strengths":[],"weaknesses":[],"recommended_cuts":[],"recommended_additions":[]
        })}}]}
        with patch.object(self.worker,"model_request",return_value=bad):
            with self.assertRaisesRegex(RuntimeError,"CLOUD_MODEL_DIAGNOSTIC_INVALID"):
                self.worker.lm_diagnose("1 Sol Ring",{"total_cards":1})

    def test_failed_model_does_not_upload_or_complete_fulfillment(self):
        calls=[]
        job={"fulfillment_id":"synthetic-f1","order_id":"synthetic-o1",
             "input_payload":{"decklist":"1 Sol Ring\\n1 Command Tower"}}
        def rpc(name,args):
            calls.append((name,args))
            return [job] if name=="claim_marketplace_fulfillment" else True
        with patch.object(self.worker,"rpc",side_effect=rpc),patch.object(self.worker,"analyze",return_value={"deck_hash":"synthetic"}),patch.object(self.worker,"lm_diagnose",side_effect=RuntimeError("CLOUD_MODEL_NOT_CONFIGURED")),patch.object(self.worker,"upload") as upload:
            self.assertTrue(self.worker.run_once())
            upload.assert_not_called()
        self.assertEqual([x[0] for x in calls],["claim_marketplace_fulfillment","fail_marketplace_fulfillment"])
        self.assertEqual(calls[1][1]["p_reason"],"CLOUD_MODEL_NOT_CONFIGURED")
        self.assertFalse(list(Path(self.tmp.name).glob("*.md")))


    def test_complete_commander_decklist_accepts_quantity_notation_and_headers(self):
        deck="Commander:\n1x Synthetic Commander\nMainboard:\n99 Synthetic Basic Lands"
        self.assertEqual(self.worker.parse_deck(deck),[
            (1,"Synthetic Commander"),(99,"Synthetic Basic Lands")])
        deck="\n".join("1 Synthetic Card "+str(i) for i in range(100))
        self.assertEqual(len(self.worker.parse_deck(deck)),100)

    def test_incomplete_or_malformed_decklist_is_never_accepted(self):
        full="\n".join("1 Synthetic Card "+str(i) for i in range(100))
        cases=[
            "\n".join("1 Synthetic Card "+str(i) for i in range(99)),
            full+"\n1 Extra Card",
            full+"\nSideboard: 1 Extra Card",
            full+"\nMaybeboard:",
            "0 Invalid Card\n"+full,
            "1000 Invalid Quantity\n"+full,
            "1xMalformed Quantity\n"+full,
            "100 https://example.test/card",
            "100 <script>alert(1)</script>",
            "100 Synthetic Card\n1 Extra Card",
            "Commander:\nMainboard:\n",
            "100 "+("X"*161),
        ]
        for deck in cases:
            with self.subTest(case=deck[:50]):
                with self.assertRaisesRegex(RuntimeError,"^DECKLIST_REQUIRES_CORRECTION$"):
                    self.worker.parse_deck(deck)

    def test_invalid_paid_deck_never_reaches_enrichment_model_or_delivery(self):
        calls=[]
        job={"fulfillment_id":"synthetic-f-invalid","order_id":"synthetic-o-invalid",
             "input_payload":{"decklist":"99 Synthetic Cards"}}
        def rpc(name,args):
            calls.append((name,args))
            return [job] if name=="claim_marketplace_fulfillment" else True
        with patch.object(self.worker,"rpc",side_effect=rpc),\
             patch.object(self.worker,"scryfall_batch") as enrich,\
             patch.object(self.worker,"lm_diagnose") as model,\
             patch.object(self.worker,"upload") as upload:
            self.assertTrue(self.worker.run_once())
            enrich.assert_not_called()
            model.assert_not_called()
            upload.assert_not_called()
        self.assertEqual([name for name,_ in calls],
                         ["claim_marketplace_fulfillment","fail_marketplace_fulfillment"])
        self.assertEqual(calls[1][1]["p_reason"],"awaiting_buyer_input")
        self.assertFalse(list(Path(self.tmp.name).glob("*.md")))


if __name__=="__main__":
    unittest.main()
