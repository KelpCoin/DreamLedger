#!/usr/bin/env python3
"""Unit tests for link_diagnostic. Stdlib only."""
from __future__ import annotations

import json
import socket
import tempfile
import unittest
from pathlib import Path

import link_diagnostic as D


def L(id="plink_a", **o):
    d = {
        "id": id,
        "active": True,
        "currency": "nzd",
        "metadata": {"sku_id": "S1"},
        "after_completion": {
            "type": "redirect",
            "redirect": {"url": "https://shop.test/thanks?s={CHECKOUT_SESSION_ID}"},
        },
    }
    d.update(o)
    return d


R = {
    "required_metadata_any": ["sku_id", "sku"],
    "expected_currency": "nzd",
    "excluded_terms": ["n8n"],
    "allowed_redirect_hosts": ["shop.test"],
    "redirect_needs_session_placeholder": True,
}


def codes(l, rules=R):
    return sorted(x["code"] for x in D.check_link(l, rules))


class Checks(unittest.TestCase):
    def test_a_good_link_has_no_findings(self):
        self.assertEqual(codes(L()), [])

    def test_missing_key_and_the_payment_intent_trap(self):
        self.assertEqual(codes(L(metadata={"dreamledger_sku": "S1"})), ["MISSING_REQUIRED_METADATA"])
        self.assertEqual(
            codes(L(metadata={}, payment_intent_data={"metadata": {"sku_id": "S1"}})),
            ["METADATA_ONLY_ON_PAYMENT_INTENT"],
        )

    def test_currency_redirects_exclusions_manual(self):
        self.assertEqual(codes(L(currency="usd")), ["CURRENCY_MISMATCH"])
        self.assertEqual(codes(L(after_completion={"type": "hosted_confirmation"})), ["NO_AFTER_COMPLETION_REDIRECT"])
        self.assertIn(
            "REDIRECT_NOT_HTTPS",
            codes(L(after_completion={"type": "redirect", "redirect": {"url": "http://shop.test/t?s={CHECKOUT_SESSION_ID}"}})),
        )
        self.assertIn(
            "REDIRECT_LOCAL_OR_PLACEHOLDER",
            codes(L(after_completion={"type": "redirect", "redirect": {"url": "https://localhost/x"}})),
        )
        self.assertIn(
            "REDIRECT_HOST_NOT_ALLOWED",
            codes(L(after_completion={"type": "redirect", "redirect": {"url": "https://old.test/t?s={CHECKOUT_SESSION_ID}"}})),
        )
        self.assertEqual(
            codes(L(after_completion={"type": "redirect", "redirect": {"url": "https://shop.test/t"}})),
            ["REDIRECT_MISSING_SESSION_PLACEHOLDER"],
        )
        self.assertEqual(codes(L(metadata={"sku_id": "S1", "note": "N8N rescue"})), ["EXCLUDED_TERM"])
        self.assertEqual(codes(L(metadata={"sku_id": "S1", "fulfillment": "manual_pdf"})), ["MANUAL_FULFILMENT_DECLARED"])

    def test_inactive_links_are_noted_not_blamed(self):
        self.assertEqual(codes(L(active=False)), ["LINK_INACTIVE", "NO_INACTIVE_MESSAGE"])
        self.assertEqual(codes(L(active=False, inactive_message="Moved: see shop.test")), ["LINK_INACTIVE"])

    def test_rules_are_optional_so_nothing_merchant_specific_is_assumed(self):
        self.assertEqual(codes(L(metadata={}, currency="usd"), {}), [])


class Report(unittest.TestCase):
    def setUp(self):
        self.links = [L("p1"), L("p2", metadata={"sku_id": "S1"}), L("p3", metadata={"x": 1}), L("p4", active=False)]
        self.full = D.diagnose(self.links, R, "abc")

    def test_duplicates_across_active_links_are_found(self):
        d = {r["link_id"]: [x["code"] for x in r["findings"]] for r in self.full["links"]}
        self.assertIn("DUPLICATE_ACTIVE_LINKS", d["p1"])
        self.assertIn("DUPLICATE_ACTIVE_LINKS", d["p2"])
        self.assertNotIn("DUPLICATE_ACTIVE_LINKS", d["p3"])

    def test_counts_and_fixes(self):
        self.assertEqual((self.full["links_reviewed"], self.full["active_links"]), (4, 3))
        self.assertEqual(self.full["finding_counts"]["MISSING_REQUIRED_METADATA"], 1)
        self.assertIn("MISSING_REQUIRED_METADATA", self.full["fixes"])
        self.assertIn("does not test a live payment", self.full["disclaimer"])

    def test_free_view_shows_problem_types_but_no_ids_or_fixes_and_the_commitment_checks_out(self):
        fr = D.free_view(self.full)
        t = json.dumps(fr)
        self.assertNotIn("p1", t)
        self.assertNotIn("fixes", fr)
        self.assertNotIn("links", fr)
        self.assertEqual(fr["finding_counts"], self.full["finding_counts"])
        self.assertTrue(D.verify_commitment(fr, self.full))
        tampered = json.loads(json.dumps(self.full))
        tampered["links"][0]["findings"] = []
        self.assertFalse(D.verify_commitment(fr, tampered))
        fr2 = dict(fr)
        fr2["links_with_problems"] = 0
        self.assertFalse(D.verify_commitment(fr2, self.full))

    def test_deterministic_and_markdown_tiers(self):
        self.assertEqual(D.diagnose(self.links, R, "abc"), D.diagnose(self.links, R, "abc"))
        full_md, free_md = D.to_markdown(self.full, "full"), D.to_markdown(D.free_view(self.full), "free")
        self.assertIn("p3", full_md)
        self.assertIn("How to fix", full_md)
        self.assertNotIn("p3", free_md)
        self.assertNotIn("How to fix", free_md)
        self.assertIn("Commitment", free_md)

    def test_only_whitelisted_fields_leave_the_input(self):
        l = L("p9", customer_email="a@b.co", metadata={"sku_id": "S9", "secret": "sk_" + "live_ABCDEFGH12345678"})
        out = json.dumps(D.diagnose([l], R))
        self.assertNotIn("a@b.co", out)
        self.assertNotIn("sk_live", out)


class Inputs(unittest.TestCase):
    def test_accepts_list_object_array_and_tool_wrapper_and_rejects_junk(self):
        ls = [L()]
        self.assertEqual(len(D.load_links(json.dumps({"object": "list", "data": ls}).encode())), 1)
        self.assertEqual(len(D.load_links(json.dumps(ls).encode())), 1)
        self.assertEqual(len(D.load_links(json.dumps([{"text": json.dumps({"data": ls})}]).encode())), 1)
        for bad in (b"not json", b'{"data": 5}', b"[1,2]"):
            with self.assertRaises(ValueError):
                D.load_links(bad)
        with self.assertRaises(ValueError):
            D.load_links(b"[" + b"1," * (D.MAX_BYTES // 2) + b"1]")

    def test_cli_writes_both_views_makes_no_network_calls_and_reports_bad_input(self):
        d = Path(tempfile.mkdtemp())
        (d / "l.json").write_text(json.dumps([L("p1"), L("p2", metadata={})]))
        (d / "r.json").write_text(json.dumps(R))
        seen = []
        real = socket.socket.connect
        socket.socket.connect = lambda s, a: (seen.append(a), real(s, a))[1]
        try:
            rc = D.main([str(d / "l.json"), "--rules", str(d / "r.json"), "--out", str(d / "o")])
        finally:
            socket.socket.connect = real
        self.assertEqual((rc, seen), (0, []))
        self.assertTrue(all((d / "o" / f).exists() for f in ("report_full.json", "report_free.json", "report_full.md", "report_free.md")))
        full, free = json.loads((d / "o" / "report_full.json").read_text()), json.loads((d / "o" / "report_free.json").read_text())
        self.assertTrue(D.verify_commitment(free, full))
        self.assertEqual(D.main([str(d / "nope.json")]), 2)


if __name__ == "__main__":
    unittest.main()
