#!/usr/bin/env python3
"""DOOH inventory contract tests."""
from __future__ import annotations

import importlib.util
import unittest
from datetime import timedelta
from pathlib import Path

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("dooh_inventory", HERE / "inventory.py")
inv_mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(inv_mod)

DoohInventory = inv_mod.DoohInventory
InventoryError = inv_mod.InventoryError


class DoohInventoryTest(unittest.TestCase):
    def setUp(self):
        self.inv = DoohInventory()

    def test_founding_nz_has_capacity(self):
        n = self.inv.available_count("DREAMLEDGER-BILLBOARD-NZ-100X100")
        self.assertEqual(n, 100)

    def test_campaign_500_is_gated(self):
        with self.assertRaises(InventoryError):
            self.inv.reserve("DOOH-CAMPAIGN-500", "buyer")
        summary = self.inv.summary()
        camp = next(s for s in summary["skus"] if s["sku"] == "DOOH-CAMPAIGN-500")
        self.assertEqual(camp["GATED"], 1)
        self.assertEqual(camp["AVAILABLE"], 0)

    def test_reserve_hold_release(self):
        u = self.inv.reserve("DREAMLEDGER-BILLBOARD-NZ-100X100", "sess_1")
        self.assertEqual(u["state"], "HELD")
        self.assertEqual(self.inv.available_count("DREAMLEDGER-BILLBOARD-NZ-100X100"), 99)
        self.inv.release(u["unit_id"], "sess_1")
        self.assertEqual(self.inv.available_count("DREAMLEDGER-BILLBOARD-NZ-100X100"), 100)

    def test_sold_requires_payment_ref(self):
        u = self.inv.reserve("DREAMLEDGER-BILLBOARD-NZ-100X100", "sess_2")
        with self.assertRaises(InventoryError):
            self.inv.mark_sold(u["unit_id"], "")
        sold = self.inv.mark_sold(u["unit_id"], "pi_test_settled", "sess_2")
        self.assertEqual(sold["state"], "SOLD")
        self.assertEqual(sold["payment_ref"], "pi_test_settled")

    def test_capacity_exhausted(self):
        seed = {
            "skus": [
                {
                    "sku": "TINY",
                    "capacity": 1,
                    "price_nzd": 50,
                    "sellable": True,
                    "gate": None,
                    "board": "T",
                    "tier": "FOUNDING",
                }
            ]
        }
        inv = DoohInventory(seed=seed)
        inv.reserve("TINY", "a")
        with self.assertRaises(InventoryError):
            inv.reserve("TINY", "b")

    def test_hold_expires(self):
        u = self.inv.reserve("DREAMLEDGER-BILLBOARD-NZ-100X100", "sess_3", hold_minutes=1)
        past = inv_mod.parse_iso(u["hold_expires_at"]) + timedelta(seconds=1)
        n = self.inv.expire_holds(past)
        self.assertGreaterEqual(n, 1)
        self.assertEqual(self.inv._get(u["unit_id"])["state"], "AVAILABLE")

    def test_ungate_campaign(self):
        n = self.inv.ungate_sku("DOOH-CAMPAIGN-500")
        self.assertEqual(n, 1)
        u = self.inv.reserve("DOOH-CAMPAIGN-500", "operator")
        self.assertEqual(u["state"], "HELD")

    def test_fulfillment_path(self):
        u = self.inv.reserve("DREAMLEDGER-BILLBOARD-NZ-100X100", "sess_4")
        self.inv.mark_sold(u["unit_id"], "pi_x", "sess_4")
        self.inv.mark_fulfilling(u["unit_id"])
        done = self.inv.mark_complete(u["unit_id"])
        self.assertEqual(done["state"], "COMPLETE")

    def test_summary_claims_zero_revenue(self):
        self.assertEqual(self.inv.summary()["revenue_nzd_verified"], 0)


if __name__ == "__main__":
    unittest.main()
