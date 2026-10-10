#!/usr/bin/env python3
"""Guard FightEdge consolidation into the existing DreamLedger service wall."""
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]


class FightEdgeConsolidationContract(unittest.TestCase):
    def test_canonical_static_route_is_first_party_and_not_a_redirect_shim(self):
        page = (ROOT / "public/fightedge/index.html").read_text()
        self.assertIn('href="https://dreamledger.org/fightedge/"', page)
        self.assertIn("DreamLedger", page)
        self.assertIn("Evidence-first combat-sports intelligence", page)
        self.assertNotIn("fightedge-web-live.onrender.com", page)
        self.assertNotIn('http-equiv="refresh"', page)

    def test_legacy_pages_point_to_canonical_route(self):
        for path in ("public/fight-edge.html", "public/fight-edge-mma-boxing.html"):
            content = (ROOT / path).read_text()
            self.assertIn("/fightedge/", content)

    def test_render_manifest_does_not_provision_separate_fightedge_service(self):
        manifest = (ROOT / "render.yaml").read_text().lower()
        self.assertNotRegex(manifest, r"name:\s*['\"]?fightedge")
        self.assertIn("name: dreamledger-storefront", manifest)

    def test_render_hosted_compatibility_app_redirects_to_first_party_route(self):
        middleware = (ROOT / "sports/fightedge/web/middleware.ts").read_text()
        self.assertIn('https://dreamledger.org/fightedge/', middleware)
        self.assertIn('host.endsWith(".onrender.com")', middleware)
        self.assertIn("NextResponse.redirect(destination, 308)", middleware)
        self.assertIn('destination.hash = /analysis|results|pundit/.test(path) ? "#evidence" : "#catalog"', middleware)


if __name__ == "__main__":
    unittest.main()
