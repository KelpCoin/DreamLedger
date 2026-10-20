import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
AUDIT = ROOT / "ops" / "economics" / "validate_economic_readiness.py"
SNAPSHOT = ROOT / "ops" / "economics" / "stripe-live-evidence-2026-10-20.json"
REGISTRY_PATH = ROOT / "ops" / "silos" / "CUBE-SILO-CANDIDATE-REGISTRY.json"
BUILDER = ROOT / "ops" / "silos" / "build_silo_candidates.py"


def run_audit():
    with tempfile.TemporaryDirectory() as tmp:
        output_path = Path(tmp) / "audit.json"
        subprocess.run(
            [sys.executable, str(AUDIT), "--root", str(ROOT), "--snapshot", str(SNAPSHOT),
             "--output", str(output_path)],
            check=True, capture_output=True, text=True,
        )
        return json.loads(output_path.read_text(encoding="utf-8"))


class EconomicReadinessTests(unittest.TestCase):
    def test_live_snapshot_keeps_account_level_charges_unattributed(self):
        snapshot = json.loads(SNAPSHOT.read_text(encoding="utf-8"))
        self.assertEqual(snapshot["observation_mode"], "READ_ONLY_LIVE_STRIPE_API")
        self.assertEqual(snapshot["account_level_settlement_evidence"]["successful_paid_charges"], 2)
        self.assertEqual(snapshot["account_level_settlement_evidence"]["attribution_state"], "UNMATCHED")
        self.assertFalse(snapshot["account_level_settlement_evidence"]["include_in_verified_dreamledger_revenue"])
        self.assertEqual(snapshot["economic_truth"]["verified_dreamledger_revenue_nzd"], 0)
        serialized = json.dumps(snapshot).lower()
        for forbidden in ("sk_live_", "sk_test_", "whsec_", "sb_secret_", "rk_live_", "re_secret_"):
            self.assertNotIn(forbidden, serialized)

    def test_billboard_and_mtg_contract_conflicts_remain_visible(self):
        audit = run_audit()
        self.assertEqual(audit["status"], "BLOCKED")
        finding_ids = {item["id"] for item in audit["findings"]}
        self.assertIn("BILLBOARD-CTA-INACTIVE-LIVE-LINK", finding_ids)
        self.assertIn("MTG-STRIPE-CATALOG-FULFILLMENT-CONFLICT", finding_ids)
        self.assertIn("LEDGER-READ-THEN-APPEND-RACE", finding_ids)
        self.assertIn("MTG-WORKER-REQUIRES-SUPABASE-AND-STORAGE", finding_ids)
        self.assertEqual(audit["economic_truth"]["verified_revenue_nzd"], 0)
        self.assertFalse(audit["scale_up_enabled"])
        self.assertEqual(audit["workers_provisioned"], 0)

    def test_stripe_net_balance_is_not_mislabeled_as_verified_revenue(self):
        audit = run_audit()
        truth = audit["economic_truth"]
        self.assertEqual(truth["account_level_charge_count"], 2)
        self.assertEqual(truth["account_level_net_balance_nzd"], 5.87)
        self.assertFalse(truth["account_level_net_is_verified_revenue"])
        self.assertEqual(truth["verified_revenue_nzd"], 0)

    def test_silo_registry_preserves_mtg_master_and_free_listing_trial(self):
        registry = json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))
        silos = registry["silos"]
        self.assertGreaterEqual(len(silos), 15)
        self.assertEqual(len({s["silo_id"] for s in silos}), len(silos))
        self.assertEqual(len({s["slug"] for s in silos}), len(silos))
        self.assertEqual(len({s["custom_domain"].lower() for s in silos}), len(silos))
        masters = [s for s in silos if s["role"] == "MASTER_REFERENCE"]
        self.assertEqual(len(masters), 1)
        self.assertEqual(masters[0]["silo_id"], "nz-mtg")
        self.assertEqual(masters[0]["platform_take_rate_pct"], 0)
        self.assertTrue(all(s["seller_listing_fee_pct"] == 0 for s in silos))
        self.assertTrue(all(s.get("platform_take_rate_pct") is None or s["silo_id"] == "nz-mtg"
                            for s in silos))
        self.assertEqual(registry["truth_contract"]["verified_external_revenue_nzd"], 0)

    def test_generated_manifests_are_not_provisioned_or_scaled(self):
        with tempfile.TemporaryDirectory() as tmp:
            outdir = Path(tmp) / "candidate-output"
            summary_path = Path(tmp) / "summary.json"
            subprocess.run(
                [sys.executable, str(BUILDER),
                 "--registry", str(REGISTRY_PATH),
                 "--output-dir", str(outdir),
                 "--summary", str(summary_path)],
                check=True, capture_output=True, text=True,
            )
            summary = json.loads(summary_path.read_text(encoding="utf-8"))
            self.assertEqual(summary["status"], "PASS_CANDIDATE_MANIFESTS_GENERATED_NOT_PROVISIONED")
            self.assertEqual(summary["candidate_manifest_count"], 19)
            self.assertEqual(summary["workers_provisioned"], 0)
            self.assertFalse(summary["scale_up_enabled"])
            manifests = list((outdir / "silos").glob("*/manifest.json"))
            self.assertEqual(len(manifests), 19)
            for path in manifests:
                m = json.loads(path.read_text(encoding="utf-8"))
                self.assertEqual(m["state"], "HOLD")
                self.assertFalse(m["runtime"]["public_route_live"])
                self.assertFalse(m["runtime"]["payment_link_bound"])
                self.assertFalse(m["runtime"]["database_provisioned"])
                self.assertFalse(m["tenant_isolation"]["credentials_generated"])
                self.assertEqual(m["cube_swarm"]["deployed_workers_verified"], 0)
                self.assertFalse(m["cube_swarm"]["scale_up_enabled"])
                self.assertEqual(m["economics"]["verified_revenue_nzd"], 0)


if __name__ == "__main__":
    unittest.main()
