#!/usr/bin/env python3
"""Contract tests for the offline CUBE silo scaffold generator."""
from __future__ import annotations

import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
MODULE_PATH = HERE / "generate_silo_scaffolds.py"
SPEC = importlib.util.spec_from_file_location("generate_silo_scaffolds", MODULE_PATH)
assert SPEC and SPEC.loader
factory = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(factory)


class SiloScaffoldGeneratorTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.registry = json.loads(
            (ROOT / "BEC-PRIME" / "cube" / "CUBE-SILO-REGISTRY.json").read_text(encoding="utf-8")
        )

    def test_factory_generates_every_registered_silo_without_live_provisioning(self):
        files = factory.build_bundle(self.registry)
        index = json.loads(files["manifest-index.json"])
        proof = json.loads(files["bundle-proof.json"])
        self.assertEqual(index["silo_count"], len(self.registry["silos"]))
        self.assertGreaterEqual(index["silo_count"], 30)
        self.assertEqual(index["candidate_scaffold_count"], index["silo_count"] - 1)
        self.assertEqual(index["master_silo"], "mtg")
        self.assertEqual(index["verified_external_revenue_nzd"], 0)
        self.assertFalse(index["production_mutation"])
        self.assertFalse(index["dns_changed"])
        self.assertFalse(index["database_tenant_provisioning_performed"])
        self.assertEqual(proof["status"], "SCAFFOLD_BUNDLE_GENERATED_NOT_PROVISIONED")
        self.assertEqual(proof["silo_count"], index["silo_count"])

    def test_mtg_is_referenced_as_master_and_its_inventory_is_not_copied(self):
        files = factory.build_bundle(self.registry)
        mtg = json.loads(files["silos/mtg/silo.json"])
        self.assertTrue(mtg["is_master_reference"])
        self.assertEqual(mtg["status"], "MASTER_REFERENCE_ONLY")
        self.assertEqual(mtg["commercial_model"]["peer_success_fee_pct"], 0)
        self.assertIn("public/data/mtg-catalog.json", mtg["existing_master_references"]["catalog"])
        self.assertNotIn("silos/mtg/catalog.json", files)
        self.assertIn("no catalog or customer data is copied", files["silos/mtg/reference.html"].lower())

    def test_candidate_catalogues_are_empty_and_all_activation_gates_are_closed(self):
        files = factory.build_bundle(self.registry)
        index = json.loads(files["manifest-index.json"])
        for item in index["silos"]:
            if item["slug"] == "mtg":
                continue
            slug = item["slug"]
            manifest = json.loads(files[f"silos/{slug}/silo.json"])
            catalog = json.loads(files[f"silos/{slug}/catalog.json"])
            self.assertEqual(catalog["products"], [], slug)
            self.assertFalse(catalog["checkout_enabled"], slug)
            self.assertEqual(catalog["verified_external_revenue_nzd"], 0, slug)
            for key in (
                "custom_domain_bound",
                "route_runtime_verified",
                "runtime_isolation_verified",
                "rls_verified",
                "checkout_verified",
                "fulfillment_verified",
                "external_demand_verified",
                "public_activation_authorized",
                "cube_worker_scaling_authorized",
            ):
                self.assertFalse(manifest[key], f"{slug}: {key}")
            self.assertEqual(manifest["inventory_policy"], "EMPTY_UNTIL_VERIFIED_SUPPLY_ATOM")
            self.assertTrue((f"silos/{slug}/preview.html") in files)

    def test_requested_marketplace_verticals_are_included(self):
        files = factory.build_bundle(self.registry)
        index = json.loads(files["manifest-index.json"])
        slugs = {item["slug"] for item in index["silos"]}
        for slug in (
            "mtg",
            "nz-secondhand",
            "womens-clothing",
            "baby-kids",
            "media-music",
            "b2b",
            "b2b-quotes",
            "delivery-eta",
        ):
            self.assertIn(slug, slugs)
        self.assertIn("no seller, listing, buyer, price, checkout, or demand is invented", files["silos/womens-clothing/preview.html"].lower())

    def test_duplicate_registry_identity_or_domain_fails_closed(self):
        broken = json.loads(json.dumps(self.registry))
        broken["silos"][1]["proposed_custom_domain"] = broken["silos"][0]["proposed_custom_domain"]
        with self.assertRaisesRegex(ValueError, "Duplicate proposed domain"):
            factory.build_bundle(broken)

    def test_output_cannot_be_written_into_public_or_runtime_paths(self):
        with self.assertRaisesRegex(ValueError, "protected path"):
            factory.validate_output_target(ROOT / "public" / "silo-preview")
        with self.assertRaisesRegex(ValueError, "protected path"):
            factory.validate_output_target(ROOT / "BEC-PRIME" / "generated-silos")

    def test_writer_emits_a_hash_manifest_to_a_scratch_directory(self):
        files = factory.build_bundle(self.registry)
        with tempfile.TemporaryDirectory(prefix="cube-silo-test-") as tmp:
            target = Path(tmp) / "bundle"
            factory.write_bundle(files, target)
            proof = json.loads((target / "bundle-proof.json").read_text(encoding="utf-8"))
            self.assertEqual(proof["status"], "SCAFFOLD_BUNDLE_GENERATED_NOT_PROVISIONED")
            for rel_path, digest in proof["sha256_by_path"].items():
                import hashlib
                actual = hashlib.sha256((target / rel_path).read_bytes()).hexdigest()
                self.assertEqual(actual, digest, rel_path)


if __name__ == "__main__":
    unittest.main(verbosity=2)
