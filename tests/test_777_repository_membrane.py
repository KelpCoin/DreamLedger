import importlib.util
import unittest
from pathlib import Path

from scripts.repository_artifact_contract import validate_packet

MODULE_PATH = Path(__file__).resolve().parents[1] / "scripts" / "777_repository_membrane.py"
SPEC = importlib.util.spec_from_file_location("repository_membrane_777", MODULE_PATH)
MEMBRANE = importlib.util.module_from_spec(SPEC)
assert SPEC is not None and SPEC.loader is not None
SPEC.loader.exec_module(MEMBRANE)


def lead_packet(recommendation="REFERENCE_ONLY"):
    lead = {
        "schema": MEMBRANE.LEAD_SCHEMA,
        "expedition_id": "repoexp-20261021-test",
        "found_at": "2026-10-21T01:00:00+13:00",
        "worker": {"worker_id": "local-gpu-01", "runtime": "LOCAL_GPU", "model_ids": ["scout", "critic"]},
        "source": {
            "repository_full_name": "example/widget",
            "repository_url": "https://github.com/example/widget"
        },
        "assessment": {
            "capability_gap": "A bounded search adapter could improve marketplace discovery.",
            "why_relevant": "The repo offers a pattern to evaluate against the existing search routes.",
            "existing_stack_check": "Existing catalogue and search routes identified; no second search service assumed.",
            "reuse_recommendation": recommendation
        },
        "controls": {
            "private_data_transferred": False,
            "credentials_transferred": False,
            "code_executed": False,
            "dependency_installed": False,
            "production_changed": False,
            "external_action_sent": False,
            "economic_revenue_claim": False
        }
    }
    lead["packet_sha256"] = MEMBRANE.canonical_packet_sha256(lead)
    return lead


class RepositoryMembraneTests(unittest.TestCase):
    def test_valid_lead_hydrates_against_public_metadata(self):
        repo_meta = {"private": False, "visibility": "public", "default_branch": "main"}
        commit = {"sha": "b" * 40}
        license_result = {"license": {"spdx_id": "MIT"}}
        responses = {
            "https://api.github.com/repos/example/widget": repo_meta,
            "https://api.github.com/repos/example/widget/commits/main": commit,
            "https://api.github.com/repos/example/widget/license": license_result
        }
        packet = MEMBRANE.hydrate_lead(
            lead_packet("CODE_IMPORT_CANDIDATE"),
            lambda url: responses[url],
            now="2026-10-21T01:15:00+13:00"
        )
        self.assertEqual(validate_packet(packet), [])
        self.assertEqual(packet["membrane"]["status"], "ONLINE_VALIDATED")
        self.assertEqual(packet["source"]["head_sha"], "b" * 40)
        self.assertEqual(packet["source"]["license_status"], "VERIFIED_PERMISSIVE")
        self.assertFalse(packet["controls"]["code_executed"])
        self.assertFalse(packet["controls"]["economic_revenue_claim"])

    def test_unknown_license_downgrades_code_import_to_reference_only(self):
        responses = {
            "https://api.github.com/repos/example/widget": {"private": False, "visibility": "public", "default_branch": "main"},
            "https://api.github.com/repos/example/widget/commits/main": {"sha": "c" * 40},
            "https://api.github.com/repos/example/widget/license": {"_not_found": True}
        }
        packet = MEMBRANE.hydrate_lead(
            lead_packet("CODE_IMPORT_CANDIDATE"),
            lambda url: responses[url],
            now="2026-10-21T01:15:00+13:00"
        )
        self.assertEqual(packet["assessment"]["reuse_recommendation"], "REFERENCE_ONLY")
        self.assertEqual(packet["source"]["license_status"], "UNKNOWN")
        self.assertIn("Licence is not confirmed", packet["assessment"]["next_gate"])

    def test_private_repository_is_rejected(self):
        responses = {"https://api.github.com/repos/example/widget": {"private": True, "visibility": "private"}}
        with self.assertRaisesRegex(ValueError, "not confirmed publicly accessible"):
            MEMBRANE.hydrate_lead(lead_packet(), lambda url: responses[url])

    def test_lead_with_credential_transfer_is_rejected(self):
        lead = lead_packet()
        lead["controls"]["credentials_transferred"] = True
        lead["packet_sha256"] = MEMBRANE.canonical_packet_sha256(lead)
        self.assertTrue(any("credentials_transferred" in e for e in MEMBRANE.validate_lead(lead)))

    def test_offline_lead_cannot_be_counted_without_public_metadata_hydration(self):
        lead = lead_packet()
        self.assertTrue(MEMBRANE.validate_lead(lead) == [])
        # A lead is a handoff packet, not a repository-expedition artifact. The 777 gate only admits
        # the different ONLINE_VALIDATED schema emitted by hydrate_lead().
        self.assertFalse("membrane" in lead)


if __name__ == "__main__":
    unittest.main()
