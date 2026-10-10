#!/usr/bin/env python3
"""Guard the actual DreamLedger-served FightEdge route and shared-service contract."""
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]


class FightEdgeConsolidationContract(unittest.TestCase):
    def test_actual_root_route_and_public_source_are_the_same_first_party_page(self):
        root_page = (ROOT / "fightedge/index.html").read_text()
        public_page = (ROOT / "public/fightedge/index.html").read_text()
        self.assertEqual(root_page, public_page)
        self.assertIn('href="https://dreamledger.org/fightedge/"', root_page)
        self.assertIn("Evidence-first combat-sports intelligence", root_page)
        self.assertNotIn("fightedge-web-live.onrender.com", root_page)
        self.assertNotIn('http-equiv="refresh"', root_page)

    def test_legacy_pages_point_to_canonical_route(self):
        for path in ("fight-edge.html", "public/fight-edge.html", "public/fight-edge-mma-boxing.html"):
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
