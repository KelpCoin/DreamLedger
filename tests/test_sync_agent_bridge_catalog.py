from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from scripts import sync_agent_bridge_catalog as sync


class FakeResponse:
    def __init__(self, payload: dict):
        self.payload = json.dumps(payload).encode("utf-8")

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def read(self, limit: int) -> bytes:
        return self.payload[:limit]


class AgentBridgeCatalogSyncTests(unittest.TestCase):
    def run_sync(self, payload: dict, target: Path) -> int:
        with patch.object(sync, "TARGET", target), patch.object(
            sync, "SOURCE_URL", "https://example.test/manifest"
        ), patch.object(sync.urllib.request, "urlopen", return_value=FakeResponse(payload)):
            return sync.main()

    def test_live_toll_v2_offers_are_normalized(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "catalog.json"
            payload = {
                "schema": "dreamledger/toll-road/v2",
                "status": "CONFIGURED_NOT_END_TO_END_VERIFIED",
                "revenue_nzd": 0,
                "offers": [
                    {
                        "id": "TOLL-PROBE-50C",
                        "scope": "toll-probe",
                        "price_nzd": 0.5,
                        "checkout_route": "/api/toll/v1/checkout/toll-probe",
                        "execution_route": "/api/toll/v1/probe",
                        "status": "EXPERIMENTAL_UNVERIFIED",
                    },
                    {
                        "id": "AGENT-BRIDGE-EVENTS-100",
                        "scope": "bridge-events",
                        "price_nzd": 19,
                        "checkout_route": None,
                        "execution_route": None,
                        "status": "HELD_UNTIL_PROBE_VERIFIED",
                    },
                ],
            }
            self.assertEqual(self.run_sync(payload, target), 0)
            result = json.loads(target.read_text(encoding="utf-8"))
            self.assertEqual(result["manifest_sync_status"], "FRESH")
            self.assertEqual(result["manifest_source_collection"], "offers")
            self.assertEqual(result["service_count"], 1)
            self.assertEqual(result["services"][0]["id"], "TOLL-PROBE-50C")
            self.assertEqual(result["services"][0]["route"], "/api/toll/v1/probe")
            self.assertTrue(result["services"][0]["checkout_configured"])
            self.assertFalse(result["services"][0]["settlement_verified"])
            self.assertFalse(result["services"][0]["fulfilment_verified"])

    def test_live_offer_identifier_aliases_are_normalized(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "catalog.json"
            payload = {
                "schema": "dreamledger/toll-road/v2",
                "offers": [
                    {
                        "offer_id": "TOLL-ALIAS-001",
                        "scope": "alias-probe",
                        "price_nzd": 1,
                        "execution_route": "/api/toll/v1/alias-probe",
                        "checkout_route": "/api/toll/v1/checkout/alias-probe",
                    }
                ],
            }
            self.assertEqual(self.run_sync(payload, target), 0)
            result = json.loads(target.read_text(encoding="utf-8"))
            self.assertEqual(result["manifest_sync_status"], "FRESH")
            self.assertEqual(result["service_count"], 1)
            self.assertEqual(result["services"][0]["id"], "TOLL-ALIAS-001")
            self.assertEqual(result["services"][0]["route"], "/api/toll/v1/alias-probe")
            self.assertTrue(result["services"][0]["checkout_configured"])
            self.assertFalse(result["services"][0]["settlement_verified"])
            self.assertFalse(result["services"][0]["fulfilment_verified"])

    def test_legacy_services_envelope_remains_supported(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "catalog.json"
            payload = {
                "status": "READY",
                "services": [
                    {
                        "id": "SERVICE-A",
                        "scope": "read-only",
                        "route": "/api/service-a",
                        "price_nzd": 3,
                        "checkout_configured": True,
                    }
                ],
            }
            self.assertEqual(self.run_sync(payload, target), 0)
            result = json.loads(target.read_text(encoding="utf-8"))
            self.assertEqual(result["manifest_source_collection"], "services")
            self.assertEqual(result["service_count"], 1)
            self.assertEqual(result["services"][0]["price_nzd"], 3.0)

    def test_unsupported_envelope_preserves_previous_snapshot_as_stale(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "catalog.json"
            target.write_text(json.dumps({"services": [], "service_count": 0}), encoding="utf-8")
            self.assertEqual(self.run_sync({"schema": "unknown/v1"}, target), 0)
            result = json.loads(target.read_text(encoding="utf-8"))
            self.assertEqual(result["manifest_sync_status"], "STALE_PRESERVED")
            self.assertEqual(result["manifest_sync_error"], "services_or_offers_array_missing")


    def test_empty_legacy_services_falls_back_to_live_offers(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "catalog.json"
            payload = {
                "schema": "dreamledger/toll-road/v2",
                "services": [],
                "offers": [{
                    "id": "TOLL-PROBE-50C",
                    "scope": "toll-probe",
                    "price_nzd": 0.5,
                    "execution_route": "/api/toll/v1/probe",
                    "checkout_route": "/api/toll/v1/checkout/toll-probe"
                }]
            }
            self.assertEqual(self.run_sync(payload, target), 0)
            result = json.loads(target.read_text(encoding="utf-8"))
            self.assertEqual(result["manifest_source_collection"], "offers")
            self.assertEqual(result["service_count"], 1)
            self.assertEqual(result["services"][0]["id"], "TOLL-PROBE-50C")

    def test_empty_supported_envelopes_preserve_previous_snapshot_as_stale(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "catalog.json"
            target.write_text(json.dumps({
                "schema": "dreamledger/agent-bridge-catalog/v1",
                "service_count": 1,
                "services": [{"id": "KNOWN-SERVICE", "route": "/api/known"}]
            }), encoding="utf-8")
            self.assertEqual(self.run_sync({"services": [], "offers": []}, target), 0)
            result = json.loads(target.read_text(encoding="utf-8"))
            self.assertEqual(result["manifest_sync_status"], "STALE_PRESERVED")
            self.assertEqual(result["manifest_sync_error"], "empty_services_or_offers_array")
            self.assertEqual(result["services"][0]["id"], "KNOWN-SERVICE")


if __name__ == "__main__":
    unittest.main()
