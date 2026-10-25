#!/usr/bin/env python3
"""Offline proof: 16-vessel drafts and loopback-only LM Studio integration."""
import json
import pathlib
import sys
import unittest

sys.path.insert(0,str(pathlib.Path(__file__).parent))
import local_neural_bridge as worker

SILOS=("agent_bridge","app_factory","automation","commerce","community","creator",
       "data_refinery","digital_products","dooh","dreammeez","education","evidence",
       "fightedge","licensing","marketplace","procurement")

class CreatorNeuralAdapterTests(unittest.TestCase):
    def test_all_silos_render_from_real_repository_wordbank(self):
        for silo in SILOS:
            with self.subTest(silo=silo):
                result=worker.build(silo+"-model-prompt-v1",seed=1)
                self.assertEqual(result["silo"],silo)
                self.assertEqual(result["status"],"PRIVATE_DRAFT_NO_BUYER_VALIDATION")
                self.assertFalse(result["model_invoked"])
                self.assertFalse(result["external_action_allowed"])
                self.assertIsNone(result["verified_revenue"])
                self.assertGreater(len(result["prompt"]),50)

    def test_seeded_replay(self):
        a=worker.render("procurement-shadow-product-v1",seed=23)
        b=worker.render("procurement-shadow-product-v1",seed=23)
        self.assertEqual(a,b)
        self.assertEqual(a["silo"],"procurement")

    def test_model_endpoints_fail_closed(self):
        for url in ("https://api.openai.com/v1/chat/completions",
                    "http://192.168.1.6:1234/v1/chat/completions",
                    "http://example.com:1234/v1/chat/completions",
                    "http://127.0.0.1:1234/admin",
                    "http://user:pass@127.0.0.1:1234/v1/chat/completions",
                    "http://127.0.0.1:1234/v1/chat/completions?debug=true"):
            self.assertFalse(worker.local_endpoint(url),url)
        self.assertTrue(worker.local_endpoint("http://127.0.0.1:1234/v1/chat/completions"))

    def test_neural_adapter_injected_caller_does_not_network(self):
        invoked=[]
        def caller(url,body):
            invoked.append((url,body))
            return {"choices":[{"message":{"content":"DRAFT ONLY"}}]}
        result=worker.build("digital_products-model-prompt-v1",seed=7,invoke=True,
                            endpoint="http://127.0.0.1:1234/v1/chat/completions",
                            model="mock-local",caller=caller)
        self.assertTrue(result["model_invoked"])
        self.assertEqual(result["model_result_draft_only"],"DRAFT ONLY")
        self.assertEqual(len(invoked),1)
        self.assertEqual(invoked[0][1]["model"],"mock-local")
        self.assertIn("no fabricated demand",invoked[0][1]["messages"][0]["content"].lower())
        self.assertFalse(result["external_action_allowed"])

    def test_live_model_not_required_and_external_url_rejected_before_caller(self):
        called=[]
        def caller(*args):
            called.append(args)
            return {}
        with self.assertRaises(ValueError):
            worker.build("commerce-model-prompt-v1",1,True,"https://api.example.com/v1/chat/completions",
                         "mock",caller)
        self.assertEqual(called,[])

    def test_no_adult_cross_tenant_stencil(self):
        for name in ("adult-model-prompt-v1","amplissa-model-prompt-v1","mplusa-model-prompt-v1"):
            with self.assertRaises(ValueError):
                worker.render(name)
if __name__=="__main__":unittest.main()
