import hashlib
import json
import tempfile
import unittest
from pathlib import Path

from scripts.verify_round_trip_artifact import validate


class RoundTripReceiptTests(unittest.TestCase):
    def make_package(self, root: Path, **overrides):
        artifact = root / "artifact.txt"
        artifact.write_text("reusable capability\n", encoding="utf-8")
        receipt = {
            "schema_version": 1,
            "trip_id": "test-trip-001",
            "objective": "Produce a reusable artifact",
            "origin": {"dispatch": "ci-test", "job_id": "test-job"},
            "worker": {"environment": "GitHub Actions", "model": "test-fixture"},
            "status": "SUCCEEDED",
            "started_at": "2026-10-10T00:00:00+13:00",
            "finished_at": "2026-10-10T00:00:01+13:00",
            "outputs": [{
                "path": "artifact.txt",
                "sha256": hashlib.sha256(artifact.read_bytes()).hexdigest(),
                "media_type": "text/plain",
            }],
            "checks": [{"name": "fixture-created", "status": "PASS", "evidence": "file exists"}],
            "compounding_assets": [{"path": "artifact.txt", "why": "Reusable test capability"}],
            "limitations": [],
            "external_effect": "NOT_ATTEMPTED",
            "revenue_claim": "NONE",
        }
        receipt.update(overrides)
        receipt_path = root / "round_trip_receipt.json"
        receipt_path.write_text(json.dumps(receipt), encoding="utf-8")
        return receipt_path

    def test_valid_receipt_and_hash(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            receipt = self.make_package(root)
            messages = validate(root, receipt)
            self.assertTrue(any(m.startswith("RECEIPT_VALID") for m in messages))
            self.assertTrue(any(m.startswith("HASH_OK") for m in messages))

    def test_hash_mismatch_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            receipt = self.make_package(root)
            data = json.loads(receipt.read_text())
            data["outputs"][0]["sha256"] = "0" * 64
            receipt.write_text(json.dumps(data))
            with self.assertRaisesRegex(ValueError, "SHA-256 mismatch"):
                validate(root, receipt)

    def test_path_traversal_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            receipt = self.make_package(root)
            data = json.loads(receipt.read_text())
            data["outputs"][0]["path"] = "../escape.txt"
            receipt.write_text(json.dumps(data))
            with self.assertRaisesRegex(ValueError, "escapes package root"):
                validate(root, receipt)

    def test_verified_revenue_requires_evidence(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            receipt = self.make_package(root, revenue_claim="VERIFIED")
            with self.assertRaisesRegex(ValueError, "revenue_evidence"):
                validate(root, receipt)

    def test_observed_external_effect_requires_evidence(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            receipt = self.make_package(root, external_effect="OBSERVED")
            with self.assertRaisesRegex(ValueError, "external_evidence"):
                validate(root, receipt)

    def test_success_cannot_have_failed_check(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            receipt = self.make_package(root, checks=[{"name": "bad", "status": "FAIL"}])
            with self.assertRaisesRegex(ValueError, "failing check"):
                validate(root, receipt)

    def test_success_requires_compounding_asset_or_explanation(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            receipt = self.make_package(root, compounding_assets=[])
            with self.assertRaisesRegex(ValueError, "NO_REUSABLE_ASSET"):
                validate(root, receipt)

    def test_blocked_receipt_is_valid_without_revenue(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            receipt = self.make_package(root, status="BLOCKED", compounding_assets=[], limitations=["external runtime unavailable; NO_REUSABLE_ASSET"])
            messages = validate(root, receipt)
            self.assertTrue(any("status=BLOCKED" in m for m in messages))


if __name__ == "__main__":
    unittest.main()
