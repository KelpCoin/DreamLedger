import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
REGISTRY_PATH = ROOT / "ops/economic/silo-clone-registry.json"
VERIFIER_PATH = ROOT / "ops/economic/verify_clone_economics.py"


class SiloCloneEconomicContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.registry = json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))
        cls.temp_dir = tempfile.TemporaryDirectory(prefix="beck-economic-audit-")
        cls.report_path = Path(cls.temp_dir.name) / "BEC-ECONOMIC-READINESS.json"
        proc = subprocess.run(
            [
                sys.executable,
                str(VERIFIER_PATH),
                "--output",
                str(cls.report_path),
            ],
            cwd=ROOT,
            text=True,
            capture_output=True,
            check=False,
        )
        if proc.returncode != 0:
            raise AssertionError(
                "Verifier should report blockers as data, not crash.\n"
                + proc.stdout
                + "\n"
                + proc.stderr
            )
        cls.stdout = proc.stdout
        cls.report = json.loads(cls.report_path.read_text(encoding="utf-8"))

    @classmethod
    def tearDownClass(cls):
        cls.temp_dir.cleanup()

    def check_by_id(self, check_id):
        return next(c for c in self.report["checks"] if c["id"] == check_id)

    def test_master_mtg_and_clone_ids_are_unique(self):
        silos = self.registry["silos"]
        ids = [s["silo_id"] for s in silos]
        domains = [s["domain_candidate"] for s in silos]
        masters = [s for s in silos if s["role"] == "CANONICAL_MASTER"]
        clones = [s for s in silos if s["role"] == "REUSABLE_VERTICAL_CLONE"]
        self.assertEqual(len(ids), len(set(ids)))
        self.assertEqual(len(domains), len(set(domains)))
        self.assertEqual(len(masters), 1)
        self.assertEqual(masters[0]["silo_id"], "nz-mtg")
        self.assertGreaterEqual(len(clones), 10)
        self.assertEqual(self.registry["clone_factory"]["total_silo_configurations"], len(silos))
        self.assertEqual(self.registry["clone_factory"]["staged_clone_count"], len(clones))

    def test_every_new_vertical_is_staged_not_provisioned(self):
        for silo in self.registry["silos"]:
            readiness = silo["readiness"]
            self.assertFalse(readiness["domain_provisioned"], silo["silo_id"])
            self.assertFalse(readiness["database_tenant_provisioned"], silo["silo_id"])
            self.assertFalse(readiness["rls_cross_tenant_test_passed"], silo["silo_id"])
            self.assertFalse(readiness["production_launch_authorized"], silo["silo_id"])
            self.assertFalse(readiness["cube_autoscaling_enabled"], silo["silo_id"])
            self.assertEqual(silo["commercial_bootstrap"]["seller_listing_fee_nzd"], 0)
            self.assertEqual(silo["commercial_bootstrap"]["transaction_take_rate_pct"], 0)

    def test_clone_factory_cannot_copy_live_data_or_credentials(self):
        factory = self.registry["clone_factory"]
        self.assertFalse(factory["production_provisioning_authorized"])
        self.assertFalse(factory["domain_dns_mutations_authorized"])
        self.assertFalse(factory["database_migrations_authorized"])
        self.assertFalse(factory["clone_data"])
        self.assertFalse(factory["clone_credentials"])
        self.assertFalse(factory["clone_live_payment_configuration"])

    def test_worker_scaling_is_configured_but_not_enabled(self):
        scale = self.registry["cube_scaling"]
        self.assertFalse(scale["automatic_provisioning_enabled"])
        self.assertTrue(scale["no_scale_from_pipeline_value"])
        self.assertEqual(scale["epv_floor_nzd"], 25)
        self.assertEqual(scale["winner_expansion_threshold_nzd"], 120)
        self.assertEqual(scale["configured_ceiling_workers"], 64)
        self.assertEqual(scale["maximum_live_workers_before_all_gates_pass"], 1)
        self.assertIn("settled", scale["epv_definition"].lower())
        self.assertIn("fulfilled", " ".join(scale["scale_requires"]).lower())

    def test_revenue_is_not_inflated_by_registry_or_simulation(self):
        self.assertEqual(self.registry["economic_truth"]["verified_external_revenue_nzd"], 0)
        self.assertEqual(self.report["verified_external_revenue_nzd"], 0)
        self.assertEqual(self.report["overall_status"], "BLOCKED")
        self.assertIn("pipeline value", " ".join(self.registry["economic_truth"]["never_revenue"]).lower())

    def test_audit_detects_known_mtg_product_contract_mismatch(self):
        self.assertEqual(self.check_by_id("MTG_DIAGNOSTIC_CHECKOUT")["status"], "BLOCKED")
        self.assertEqual(self.check_by_id("MTG_PRODUCT_FULFILLMENT_CONSISTENCY")["status"], "BLOCKED")
        self.assertEqual(self.check_by_id("MTG_CI_EXPECTATION")["status"], "BLOCKED")

    def test_audit_detects_billboard_and_avatar_source_mismatches(self):
        self.assertEqual(self.check_by_id("BILLBOARD_CHECKOUT_MANIFEST_PARITY")["status"], "BLOCKED")
        self.assertEqual(self.check_by_id("AVATAR_COSMETIC_SETTLEMENT_PARITY")["status"], "BLOCKED")

    def test_operator_focus_aligns_with_billboard_priority(self):
        self.assertEqual(self.check_by_id("CURRENT_COMMERCIAL_PRIORITY_ALIGNMENT")["status"], "PASS")

    def test_missing_runtime_artifacts_are_blockers_not_assumed_capabilities(self):
        for check_id in (
            "MTG_SCHEMA_SOURCE",
            "MTG_SEED_SOURCE",
            "CUBE_SCALER_SOURCE",
            "TENANT_SPAWNER_SOURCE",
            "DOMINO_FENCING_SOURCE",
            "REBUILT_ENGINE_SOURCE",
            "TEN_DOMAIN_MIGRATION_SOURCE",
        ):
            self.assertEqual(self.check_by_id(check_id)["status"], "BLOCKED", check_id)

    def test_no_database_or_provider_mutation_is_required_by_audit(self):
        self.assertEqual(self.report["audit_mode"], "READ_ONLY_STATIC_SOURCE_INSPECTION")
        self.assertEqual(self.report["silo_registry"]["production_silos_verified"], 0)
        self.assertFalse(self.report["silo_registry"]["automatic_scaling_enabled"])
        self.assertIn("LIVE_EXTERNAL_RECONCILIATION", [c["id"] for c in self.report["checks"]])
        self.assertEqual(self.check_by_id("LIVE_EXTERNAL_RECONCILIATION")["status"], "BLOCKED")


if __name__ == "__main__":
    unittest.main(verbosity=2)
