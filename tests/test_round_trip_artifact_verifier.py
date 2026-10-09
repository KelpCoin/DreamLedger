from __future__ import annotations
import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from scripts.verify_round_trip_artifact import validate


def make_package(root: Path, digest_override=None, revenue="NONE"):
    (root / "result.txt").write_text("synthetic artifact\n", encoding="utf-8")
    digest = hashlib.sha256((root / "result.txt").read_bytes()).hexdigest()
    data = {"schema_version": 1, "trip_id": "test-trip-001", "objective": "Test receipt integrity", "origin": {"surface": "CI"}, "worker": {"environment": "test"}, "status": "SUCCEEDED", "started_at": "2026-10-10T00:00:00+00:00", "finished_at": "2026-10-10T00:00:01+00:00", "outputs": [{"path": "result.txt", "sha256": digest_override or digest, "media_type": "text/plain"}], "checks": [{"name": "fixture", "status": "PASS"}], "compounding_assets": [{"path": "result.txt", "rationale": "synthetic fixture"}], "limitations": ["TEST_ONLY"], "external_effect": "NOT_ATTEMPTED", "revenue_claim": revenue}
    (root / "round_trip_receipt.json").write_text(json.dumps(data), encoding="utf-8")
    return root / "round_trip_receipt.json"


class ReceiptVerifierTests(unittest.TestCase):
    def test_valid_package(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            receipt = make_package(root)
            self.assertTrue(any(x.startswith("RECEIPT_VALID") for x in validate(root, receipt)))

    def test_hash_mismatch_fails(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            receipt = make_package(root, digest_override="0" * 64)
            with self.assertRaisesRegex(ValueError, "SHA-256 mismatch"):
                validate(root, receipt)

    def test_verified_revenue_requires_evidence(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            receipt = make_package(root, revenue="VERIFIED")
            with self.assertRaisesRegex(ValueError, "revenue_evidence"):
                validate(root, receipt)

    def test_observed_effect_requires_evidence(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            receipt = make_package(root)
            data = json.loads(receipt.read_text(encoding="utf-8"))
            data["external_effect"] = "OBSERVED"
            receipt.write_text(json.dumps(data), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "external_evidence"):
                validate(root, receipt)


if __name__ == "__main__":
    unittest.main()
