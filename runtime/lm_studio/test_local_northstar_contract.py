import os
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RUNTIME = ROOT / "runtime" / "lm_studio"


class LocalNorthStarContractTests(unittest.TestCase):
    def read(self, relative):
        return (ROOT / relative).read_text(encoding="utf-8")

    def test_remote_reads_are_opt_in(self):
        controller = self.read("runtime/lm_studio/economic_swarm_controller.py")
        self.assertIn('LOCAL_ONLY = os.environ.get("DREAMLEDGER_ALLOW_REMOTE_READS","").strip() != "1"', controller)
        self.assertIn("if not LOCAL_ONLY and SUPA and KEY:", controller)
        self.assertIn('child_env["DREAMLEDGER_LOCAL_ONLY"] = "1" if LOCAL_ONLY else "0"', controller)
        self.assertIn('"SKIPPED_LOCAL_ONLY" if LOCAL_ONLY', controller)

    def test_local_audit_short_circuits_before_any_network_or_cache_read(self):
        audit = self.read("runtime/lm_studio/north_star_priority_audit.py")
        local_gate = audit.index('if os.environ.get("DREAMLEDGER_LOCAL_ONLY") == "1":')
        cache_read = audit.index("cached = get_probe_cache()", local_gate)
        network_call = audit.index("with urlopen(request, timeout=8)", cache_read)
        self.assertLess(local_gate, cache_read)
        self.assertLess(cache_read, network_call)
        self.assertIn('"network_requested": False', audit)
        self.assertIn('local_probe["branch_classification"] == "SKIPPED_LOCAL_ONLY"', audit)

    def test_launcher_has_three_roles_and_loopback_only(self):
        launcher = self.read("runtime/lm_studio/Start-NorthStarLocal.ps1")
        for identifier in (
            'Identifier="phi-3-mini-4k-instruct"',
            'Identifier="qwen2.5-7b-instruct"',
            'Identifier="qwen_qwen2.5-vl-7b-instruct"',
        ):
            self.assertIn(identifier, launcher)
        self.assertIn('"--bind","127.0.0.1"', launcher)
        self.assertIn('http://127.0.0.1:1234/v1/models', launcher)
        self.assertIn('$env:DREAMLEDGER_LOCAL_ONLY = "1"', launcher)
        self.assertIn('$env:DREAMLEDGER_ALLOW_REMOTE_READS = "0"', launcher)
        self.assertIn('status = "BLOCKED"', launcher)
        self.assertNotIn("0.0.0.0", launcher)
        self.assertNotIn("--gpu max", launcher)
        self.assertNotIn('Invoke-WebRequest -Uri "https://', launcher)

    def test_installer_starts_launcher_at_logon_not_bare_supervisor(self):
        installer = self.read("runtime/lm_studio/Install-NorthStarSupervisorTask.ps1")
        self.assertIn('Start-NorthStarLocal.ps1', installer)
        self.assertIn('New-ScheduledTaskTrigger -AtLogOn', installer)
        self.assertIn('New-ScheduledTaskAction -Execute "powershell.exe"', installer)
        self.assertIn('$PythonPath', installer)
        self.assertIn('$Audit --self-test', installer)
        self.assertNotIn('$PythonPath $Supervisor --interval-seconds', installer)

    def test_bootstrap_does_not_download_models(self):
        launcher = self.read("runtime/lm_studio/Start-NorthStarLocal.ps1")
        self.assertIn("No model download was attempted", launcher)
        self.assertNotIn('Invoke-Lms -Arguments @("get"', launcher)
        self.assertNotIn('Invoke-Lms -Arguments @("pull"', launcher)


    def test_supervisor_duplicate_lock_timeout_and_fail_closed_exit(self):
        supervisor = self.read("runtime/lm_studio/north_star_supervisor.py")
        installer = self.read("runtime/lm_studio/Install-NorthStarSupervisorTask.ps1")
        self.assertIn("SUPERVISOR_ALREADY_RUNNING", supervisor)
        self.assertIn("msvcrt.locking", supervisor)
        self.assertIn("fcntl.flock", supervisor)
        self.assertIn("proc.wait(timeout=timeout_seconds)", supervisor)
        self.assertIn('"CONTROLLER_NONZERO_EXIT"', supervisor)
        self.assertIn('"CONTROLLER_OUTPUT_NOT_VALID_JSON"', supervisor)
        self.assertIn('"taskkill.exe"', supervisor)
        self.assertIn("MultipleInstances IgnoreNew", installer)
        self.assertIn("-RestartCount 3", installer)

    def test_no_unsafe_public_monetization_components_are_bootstrapped(self):
        launcher = self.read("runtime/lm_studio/Start-NorthStarLocal.ps1")
        installer = self.read("runtime/lm_studio/Install-NorthStarSupervisorTask.ps1")
        combined = launcher + "\\n" + installer
        for unsafe_component in (
            "satgate",
            "stripe listen",
            "cloudflared tunnel",
            "WinSW",
            "LIGHTNING_KEY",
            "WEBHOOK_SIGNING_SECRET",
        ):
            self.assertNotIn(unsafe_component.lower(), combined.lower())
        self.assertIn('New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive', installer)
        self.assertIn('DREAMLEDGER_ALLOW_REMOTE_READS = "0"', launcher)

    def test_supervisor_contract_is_documented_without_claiming_full_autonomy(self):
        doc = self.read("runtime/lm_studio/BECK_BOOTSTRAP.md")
        self.assertIn("not a general-purpose", doc)
        self.assertIn("At least two successful observed cycles", doc)
        self.assertIn("Verified external revenue remains NZ$0.00", doc)
        self.assertIn("No Stripe webhook server/listener", doc)


if __name__ == "__main__":
    unittest.main()
