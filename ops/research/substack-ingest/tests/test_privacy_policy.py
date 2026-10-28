"""Regression: subscriber research must never land in BECK's public site or source checkout."""
import tempfile
import unittest
from pathlib import Path
from substack_ingest import privacy, importer, beck_adapter

class OwnerPrivatePolicy(unittest.TestCase):
    def test_public_site_and_source_paths_rejected(self):
        source = privacy.SOURCE_ROOT
        for path in (source / "outbox", source / "personal_config.json", source / "kb.sqlite"):
            with self.subTest(path=str(path)), self.assertRaisesRegex(ValueError, "OUTSIDE"):
                privacy.require_private_path(path, "private")
        for path in (Path(__file__).resolve().parents[4] / "public" / "newsletter-digest.md",
                     Path.home() / "public_html" / "kb.sqlite"):
            with self.subTest(path=str(path)), self.assertRaises(ValueError):
                privacy.require_private_path(path, "private")
    def test_ordinary_private_path_allowed(self):
        with tempfile.TemporaryDirectory(prefix="substack-private-") as t:
            self.assertEqual(Path(privacy.require_private_path(Path(t) / "research.sqlite")), Path(t) / "research.sqlite")
    def test_bundle_import_refuses_public_knowledge_base_before_looking_at_files(self):
        with tempfile.TemporaryDirectory(prefix="substack-private-") as t:
            with self.assertRaises(ValueError):
                importer.import_bundle(t, str(privacy.SOURCE_ROOT / "outbox"))
    def test_metadata_export_refuses_public_destination(self):
        with tempfile.TemporaryDirectory(prefix="substack-private-") as t:
            with self.assertRaises(ValueError):
                beck_adapter.export_kb_evidence(t, str(privacy.SOURCE_ROOT / "public-evidence.json"))
    def test_never_grant_truth_oracle_auto_publishing(self):
        p=privacy.POLICY
        self.assertEqual(p["classification"], "OWNER_PRIVATE_RESEARCH")
        self.assertFalse(p["web_publication_allowed"])
        self.assertFalse(p["may_trigger_commerce"])
        self.assertFalse(p["may_trigger_truth_oracle_release"])
        self.assertIn("specific founder approval", p["truth_oracle_requires"])

if __name__ == "__main__":
    unittest.main()
