import json
import subprocess
import tempfile
import unittest
from pathlib import Path

import north_star_build_worker as worker
from north_star_build_executor import build

def job(issue=712, status="queued", job_id="job-712"):
    return {"id":job_id,"type":"north_star_build","status":status,"created_at":"2026-10-14T00:00:00Z",
            "payload":{"task_issue":issue,"task_id":"BUILD-ISSUE-"+str(issue)+"-MTG-STORE-AUDIT"}}

def good_files():
    module="'use strict';\nconst SAFE_MODULE=true;\nfunction auditStore(){return {status:'REVIEW_COMPLETE',findings:[],unknowns:['revenue not measured']};}\nfunction safeUrl(){return null;}\nmodule.exports={auditStore,safeUrl};\n"
    page='<!doctype html><html><head><meta name="robots" content="noindex,nofollow"></head><body>SAFE_PAGE</body></html>'
    return [{"path":"BEC-PRIME/lib/mtgStoreAudit.js","content":module},
            {"path":"public/silos/mtg-store-audit/index.html","content":page}]

class SelectorTests(unittest.TestCase):
    def test_prioritizes_issue_712(self):
        self.assertEqual(worker.select_candidate([job(715,"queued","later"),job()])["id"],"job-712")
    def test_no_job_and_wrong_status(self):
        self.assertIsNone(worker.select_candidate([]))
        self.assertIsNone(worker.select_candidate([job(status="leased")]))
    def test_free_text_is_not_an_issue_contract(self):
        self.assertIsNone(worker.select_candidate([{"id":"x","status":"queued","payload":{"description":"please do #712"}}]))
    def test_rpc_wrapper_normalization(self):
        self.assertEqual(worker.normalize_job({"select_north_star_build_job":[job()]})["id"],"job-712")
        self.assertIsNone(worker.normalize_job({"select_north_star_build_job":None}))

class CycleTests(unittest.TestCase):
    def make_root(self, include_source=True):
        temp=tempfile.TemporaryDirectory()
        root=Path(temp.name)
        task=root/"ops/cube-swarm/tasks"
        task.mkdir(parents=True)
        if include_source: (root/"source.txt").write_text("source evidence",encoding="utf-8")
        contract={"schema_version":"dreamledger/bounded-build-task/v1","task_id":"BUILD-ISSUE-712-MTG-STORE-AUDIT",
          "github_issue":"https://github.com/KelpCoin/DreamLedger/issues/712","queue_contract":{"required_task_issue":712},
          "source_refs":["source.txt"],"writable_paths":["BEC-PRIME/lib/mtgStoreAudit.js","public/silos/mtg-store-audit/index.html"],
          "authorization":{"internal_file_build_allowed":True}}
        (task/"MTG-STORE-AUDIT-BUILD.json").write_text(json.dumps(contract),encoding="utf-8")
        return temp,root
    def test_dry_run_never_claims(self):
        temp,root=self.make_root()
        class Fake:
            configured=True
            claimed=False
            def preview(self,issue,worker): return job()
            def claim(self,issue,worker): self.claimed=True; raise AssertionError("claim should not happen in dry-run")
        bridge=Fake()
        try:
            out=worker.run_cycle(root,bridge=bridge,execute=False)
            self.assertEqual(out["status"],"DRY_RUN_READY")
            self.assertFalse(out["claim_performed"])
            self.assertFalse(bridge.claimed)
        finally: temp.cleanup()
    def test_no_job_holds(self):
        temp,root=self.make_root()
        class Fake:
            configured=True
            def preview(self,issue,worker): return None
        try: self.assertEqual(worker.run_cycle(root,bridge=Fake(),execute=False)["reason"],"NO_ELIGIBLE_JOB")
        finally: temp.cleanup()
    def test_claim_conflict_holds(self):
        temp,root=self.make_root()
        class Fake:
            configured=True
            def preview(self,issue,worker): return job()
            def claim(self,issue,worker): return None
        try: self.assertEqual(worker.run_cycle(root,bridge=Fake(),execute=True)["reason"],"CLAIM_CONFLICT")
        finally: temp.cleanup()
    def test_missing_source_holds_before_claim(self):
        temp,root=self.make_root(False)
        class Fake:
            configured=True
            claimed=False
            def preview(self,issue,worker): return job()
            def claim(self,issue,worker): self.claimed=True; return job()
        bridge=Fake()
        try:
            out=worker.run_cycle(root,bridge=bridge,execute=True)
            self.assertEqual(out["reason"],"SOURCE_FILES_MISSING")
            self.assertFalse(bridge.claimed)
        finally: temp.cleanup()

class BuildTests(unittest.TestCase):
    def setup_repo(self,good=True):
        temp=tempfile.TemporaryDirectory(); root=Path(temp.name)
        for rel in ["ops/cube-swarm/tasks","ops/cube-swarm/verify","runtime/lm_studio/worktrees"]:
            (root/rel).mkdir(parents=True,exist_ok=True)
        (root/"src.txt").write_text("test source",encoding="utf-8")
        contract={"schema_version":"dreamledger/bounded-build-task/v1","task_id":"BUILD-ISSUE-712-MTG-STORE-AUDIT",
          "github_issue":"https://github.com/KelpCoin/DreamLedger/issues/712","queue_contract":{"required_task_issue":712},
          "source_refs":["src.txt"],"writable_paths":["BEC-PRIME/lib/mtgStoreAudit.js","public/silos/mtg-store-audit/index.html"],
          "base_branch":"main","limits":{"timeout_seconds":15},"authorization":{"internal_file_build_allowed":True}}
        (root/"ops/cube-swarm/tasks/MTG-STORE-AUDIT-BUILD.json").write_text(json.dumps(contract),encoding="utf-8")
        verifier="""import fs from 'node:fs';
const a=fs.readFileSync('BEC-PRIME/lib/mtgStoreAudit.js','utf8');
const b=fs.readFileSync('public/silos/mtg-store-audit/mtgStoreAudit.js','utf8');
const p=fs.readFileSync('public/silos/mtg-store-audit/index.html','utf8');
if(a!==b || !a.includes('SAFE_MODULE') || !p.includes('noindex,nofollow')) process.exit(1);
"""
        (root/"ops/cube-swarm/verify/verify-mtg-store-audit.mjs").write_text(verifier,encoding="utf-8")
        def g(args,cwd=root):
            p=subprocess.run(args,cwd=str(cwd),capture_output=True,text=True)
            if p.returncode: raise AssertionError(p.stderr or p.stdout)
            return p.stdout
        g(["git","init","-b","main"])
        g(["git","config","user.name","worker test"])
        g(["git","config","user.email","worker@example.invalid"])
        g(["git","add","."]); g(["git","commit","-m","fixture base"])
        bare=root.parent/(root.name+"-origin.git")
        subprocess.run(["git","init","--bare",str(bare)],capture_output=True,check=True)
        g(["git","remote","add","origin",str(bare)])
        g(["git","push","-u","origin","main"])
        g(["git","fetch","origin","main"])
        def fake(base,model,prompt,tokens):
            if model=="qwen2.5-7b-instruct": return json.dumps({"decision":"APPROVE","blockers":[]})
            if model=="phi-3-mini-4k-instruct": return json.dumps({"steps":["write two files"],"files":["module","page"],"risks":[]})
            files=good_files() if good else [{"path":x["path"],"content":"bad"} for x in good_files()]
            return json.dumps({"files":files})
        return temp,root,fake

    def test_happy_path_builds_and_hashes_isolated_artifact(self):
        temp,root,fake=self.setup_repo(True)
        try:
            out=build(root,{"source_refs":["src.txt"],"writable_paths":["BEC-PRIME/lib/mtgStoreAudit.js","public/silos/mtg-store-audit/index.html"],
                "base_branch":"main","limits":{"timeout_seconds":15}},job(),model_fn=fake,publish_fn=lambda root,branch,issue,proof_hash:"https://github.com/KelpCoin/DreamLedger/pull/999")
            self.assertEqual(out["status"],"BUILD_READY")
            self.assertEqual(out["validation"]["exit_code"],0)
            self.assertEqual(len(out["artifact_sha256"]),64)
            self.assertEqual(out["pr_url"],"https://github.com/KelpCoin/DreamLedger/pull/999") 
            self.assertTrue(Path(out["artifact_path"]).is_file())
            self.assertTrue(out["branch"].startswith("north-star/issue-712-"))
            self.assertFalse(out["external_action_performed"])
        finally: temp.cleanup()

    def test_validation_failure_is_bounded_and_holds(self):
        temp,root,fake=self.setup_repo(False)
        try:
            out=build(root,{"source_refs":["src.txt"],"writable_paths":["BEC-PRIME/lib/mtgStoreAudit.js","public/silos/mtg-store-audit/index.html"],
                "base_branch":"main","limits":{"timeout_seconds":15}},job(),model_fn=fake,publish_fn=lambda root,branch,issue,proof_hash:"https://github.com/KelpCoin/DreamLedger/pull/999")
            self.assertEqual(out["status"],"HOLD")
            self.assertEqual(out["reason"],"VALIDATION_FAILED")
            self.assertTrue(Path(out["artifact_path"]).is_file())
        finally: temp.cleanup()

if __name__=="__main__":
    unittest.main()
