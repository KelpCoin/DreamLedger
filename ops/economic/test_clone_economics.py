import json
import subprocess
import sys
import tempfile
import unittest

import cube_epv_gate as epv_gate
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

    def test_mtg_diagnostic_stays_held_but_registry_and_ci_agree(self):
        self.assertEqual(self.check_by_id("MTG_DIAGNOSTIC_CHECKOUT")["status"], "BLOCKED")
        self.assertEqual(self.check_by_id("MTG_PRODUCT_FULFILLMENT_CONSISTENCY")["status"], "PASS")
        self.assertEqual(self.check_by_id("MTG_CI_EXPECTATION")["status"], "PASS")
        product = json.loads((ROOT / "BEC-PRIME/catalog/products/COMMANDER-DECK-DIAGNOSTIC-001.json").read_text(encoding="utf-8"))
        registry = json.loads((ROOT / "BEC-PRIME/fulfillment/PRODUCT-FULFILLMENT-REGISTRY.json").read_text(encoding="utf-8"))
        self.assertEqual(product["checkout"]["mode"], "disabled")
        self.assertEqual(product["fulfillment"]["mode"], "disabled")
        self.assertFalse(registry["entries"]["COMMANDER-DECK-DIAGNOSTIC-001"]["ready"])

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


    def _signed_evidence(self, **overrides):
        key = "unit-test-only-hmac-key"
        payload = {
            "schema": epv_gate.SCHEMA,
            "evidence_class": "INDEPENDENTLY_RECONCILED_SETTLEMENT_AND_FULFILLMENT",
            "ledger_export_sha256": "1" * 64,
            "reconciliation_artifact_sha256": "2" * 64,
            "external_provider_reference": "test-provider-event-batch",
            "reconciler_build_sha": "3" * 40,
            "settled_revenue_nzd": 5000,
            "refunds_nzd": 0,
            "processing_fees_nzd": 0,
            "variable_fulfillment_cost_nzd": 0,
            "unique_qualified_visitors": 20,
            "settled_and_fulfilled_transactions": 20,
            "measurement_window_days": 30,
            "qualified_pending_signals": 100,
            "current_live_workers": 1,
            "daily_worker_budget_cap_nzd": 100,
            "worker_provider_connected": False,
            "durable_queue_connected": False,
            "tenant_fence_tests_passed": False,
            "duplicate_settlement_replay_tests_passed": False,
            "budget_guard_connected": False,
            "pipeline_value_nzd": 624000,
        }
        payload.update(overrides)
        payload["attestation"] = {"algorithm": "HMAC-SHA256", "signature": ""}
        payload["attestation"]["signature"] = epv_gate.make_attestation_for_trusted_reconciler(payload, key)
        return payload, key

    def test_cube_gate_holds_without_signed_evidence(self):
        decision = epv_gate.evaluate(None, None)
        self.assertEqual(decision["action"], "HOLD_NO_SCALE")
        self.assertEqual(decision["reason"], "EVIDENCE_SCHEMA_MISMATCH")
        self.assertFalse(decision["apply_enabled"])
        self.assertEqual(decision["target_workers"], 1)

    def test_cube_gate_rejects_untrusted_or_invalid_attestation(self):
        payload, key = self._signed_evidence()
        self.assertEqual(epv_gate.evaluate(payload, None)["reason"], "ATTESTATION_KEY_NOT_CONFIGURED")
        payload["attestation"]["signature"] = "0" * 64
        self.assertEqual(epv_gate.evaluate(payload, key)["reason"], "ATTESTATION_SIGNATURE_INVALID")

    def test_cube_gate_refuses_to_expand_without_real_worker_runtime(self):
        payload, key = self._signed_evidence()
        decision = epv_gate.evaluate(payload, key)
        self.assertEqual(decision["epv_nzd"], 250)
        self.assertEqual(decision["status"], "BLOCKED_RUNTIME_CAPABILITY")
        self.assertEqual(decision["action"], "HOLD_NO_SCALE_RUNTIME_UNVERIFIED")
        self.assertEqual(decision["current_workers"], 1)
        self.assertEqual(decision["target_workers"], 1)
        self.assertFalse(decision["apply_enabled"])
        self.assertEqual(decision["verified_revenue_claim_nzd"], 0)

    def test_cube_gate_only_recommends_scale_after_signed_evidence_and_runtime_gates(self):
        payload, key = self._signed_evidence(
            worker_provider_connected=True,
            durable_queue_connected=True,
            tenant_fence_tests_passed=True,
            duplicate_settlement_replay_tests_passed=True,
            budget_guard_connected=True,
        )
        decision = epv_gate.evaluate(payload, key)
        self.assertEqual(decision["action"], "WOULD_CLONE_EXPAND_SWARM")
        self.assertEqual(decision["target_workers"], 2)
        self.assertFalse(decision["apply_enabled"])
        self.assertEqual(decision["verified_revenue_claim_nzd"], 0)

    def test_cube_gate_prunes_only_from_net_contribution_epv(self):
        payload, key = self._signed_evidence(
            settled_revenue_nzd=10,
            current_live_workers=3,
            unique_qualified_visitors=20,
            worker_provider_connected=True,
            durable_queue_connected=True,
            tenant_fence_tests_passed=True,
            duplicate_settlement_replay_tests_passed=True,
            budget_guard_connected=True,
        )
        decision = epv_gate.evaluate(payload, key)
        self.assertEqual(decision["epv_nzd"], 0.5)
        self.assertEqual(decision["action"], "WOULD_PRUNE_TO_BASELINE")
        self.assertEqual(decision["target_workers"], 1)
        self.assertFalse(decision["apply_enabled"])

    def test_cube_gate_rejects_small_sample_even_if_pipeline_value_is_large(self):
        payload, key = self._signed_evidence(
            settled_and_fulfilled_transactions=3,
            pipeline_value_nzd=624000,
        )
        decision = epv_gate.evaluate(payload, key)
        self.assertEqual(decision["action"], "HOLD_NO_SCALE")
        self.assertEqual(decision["reason"], "TRANSACTION_SAMPLE_BELOW_MINIMUM")
        self.assertIsNotNone(decision["epv_nzd"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
