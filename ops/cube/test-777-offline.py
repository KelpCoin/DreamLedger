"""Regression guard: the 777 cloud refinery must keep offline discovery and block effects."""
import pathlib
import re
import unittest

ROOT=pathlib.Path(__file__).resolve().parents[2]
WORKFLOW=ROOT/'.github/workflows/777-economic-search.yml'

class Offline777Contract(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source=WORKFLOW.read_text(encoding='utf-8')

    def test_pr_checks_are_isolated_from_production(self):
        self.assertIn("offline-proof:",self.source)
        self.assertIn("if: github.event_name == 'pull_request'",self.source)
        self.assertIn("if: github.event_name != 'pull_request'",self.source)

    def test_search_has_no_success_dependency_on_remote_service(self):
        start=self.source.index("  search:\n")
        self.assertNotIn("outputs.secrets_ready",self.source[start:start+260])
        self.assertIn('node BEC-PRIME/scripts/Run-777.js',self.source)
        self.assertIn('SUPABASE_ONLINE',self.source)
        self.assertIn('CUBE_RADAR=DEGRADED_SUPABASE_QUERY',self.source)

    def test_commerce_writes_never_execute_on_cron(self):
        self.assertIn("if: github.event_name == 'workflow_dispatch' && inputs.authorize_commerce_handoff == true && needs.preflight.outputs.supabase_online == 'true'",self.source)
        self.assertIn("if: github.event_name == 'workflow_dispatch' && inputs.authorize_economic_activation == true && needs.preflight.outputs.supabase_online == 'true'",self.source)
        self.assertIn("ECONOMIC_ACTIVATION=DISABLED_ON_SCHEDULE",self.source)
        self.assertIn("COMMERCE_WRITES=DISABLED_ON_SCHEDULE",self.source)

    def test_outage_and_missing_credentials_do_not_cancel_research(self):
        self.assertIn('echo "online=false" >> "$GITHUB_OUTPUT"',self.source)
        self.assertIn('if [ "$code" = "200" ]; then',self.source)
        self.assertIn("CUBE_RADAR=BLOCKED_SUPABASE_UNAVAILABLE",self.source)
        self.assertIn("ECONOMIC_RADAR_HEARTBEAT=BLOCKED_UPSTREAM",self.source)

    def test_no_secret_literals_or_fabricated_commercial_truth(self):
        self.assertNotIn("sk_live_",self.source)
        self.assertNotIn("SUPABASE_SERVICE_ROLE_KEY: hardcoded",self.source)
        self.assertIn("MERCHANT_PAYMENT_AND_FULFILLMENT=NOT_ESTABLISHED_BY_THIS_RUN",self.source)

if __name__ == '__main__':
    unittest.main()
