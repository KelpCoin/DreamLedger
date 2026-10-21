import copy
import unittest

from scripts.repository_artifact_contract import SCHEMA, canonical_packet_sha256, validate_packet


def valid_packet():
    packet = {
        "schema": SCHEMA,
        "expedition_id": "repoexp-20261021-01",
        "observed_at": "2026-10-21T01:00:00+13:00",
        "truth_status": "UNVERIFIED",
        "worker": {"worker_id": "gpu-worker-01", "runtime": "LOCAL_GPU", "model_ids": ["model-a"]},
        "membrane": {
            "direction": "OFFLINE_TO_ONLINE_AND_RETURN",
            "status": "ONLINE_VALIDATED",
            "validated_at": "2026-10-21T01:10:00+13:00",
            "public_metadata_verified": True
        },
        "source": {
            "repository_full_name": "example/widget",
            "repository_url": "https://github.com/example/widget",
            "owner": "example",
            "visibility": "public",
            "default_branch": "main",
            "head_sha": "a" * 40,
            "checked_at": "2026-10-21T01:10:00+13:00",
            "metadata_evidence_url": "https://api.github.com/repos/example/widget",
            "license_evidence_url": "https://api.github.com/repos/example/widget/license",
            "license_status": "VERIFIED_PERMISSIVE",
            "license_spdx_id": "MIT"
        },
        "assessment": {
            "capability_gap": "Search filters missing on category pages",
            "why_relevant": "Repository demonstrates an adapter pattern that may close the gap",
            "existing_stack_check": "DreamLedger current search and catalogue routes inspected; not installed",
            "reuse_recommendation": "REFERENCE_ONLY",
            "maintenance_status": "Release dates to be checked",
            "security_status": "Not yet security-audited",
            "compatibility_status": "Framework compatibility unproven",
            "operational_cost": "No new cost until reviewed",
            "expected_benefit": "Reduce implementation uncertainty",
            "next_gate": "Review dependency tree, licence and tests"
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
    packet["packet_sha256"] = canonical_packet_sha256(packet)
    return packet


class RepositoryArtifactContractTests(unittest.TestCase):
    def test_valid_online_validated_packet(self):
        self.assertEqual(validate_packet(valid_packet()), [])

    def test_missing_license_evidence_is_rejected(self):
        packet = valid_packet()
        packet["source"]["license_evidence_url"] = ""
        packet["packet_sha256"] = canonical_packet_sha256(packet)
        self.assertTrue(any("license_evidence_url" in e for e in validate_packet(packet)))

    def test_missing_head_sha_is_rejected(self):
        packet = valid_packet()
        packet["source"]["head_sha"] = "unknown"
        packet["packet_sha256"] = canonical_packet_sha256(packet)
        self.assertTrue(any("head_sha" in e for e in validate_packet(packet)))

    def test_secret_transfer_or_install_is_rejected(self):
        packet = valid_packet()
        packet["controls"]["credentials_transferred"] = True
        packet["packet_sha256"] = canonical_packet_sha256(packet)
        self.assertTrue(any("credentials_transferred" in e for e in validate_packet(packet)))

    def test_tampered_packet_hash_is_rejected(self):
        packet = valid_packet()
        packet["assessment"]["expected_benefit"] = "tampered after hashing"
        self.assertTrue(any("packet_sha256" in e for e in validate_packet(packet)))

    def test_unknown_license_cannot_propose_code_import(self):
        packet = valid_packet()
        packet["source"]["license_status"] = "UNKNOWN"
        packet["assessment"]["reuse_recommendation"] = "CODE_IMPORT_CANDIDATE"
        packet["packet_sha256"] = canonical_packet_sha256(packet)
        self.assertTrue(any("code import requires" in e for e in validate_packet(packet)))


if __name__ == "__main__":
    unittest.main()
