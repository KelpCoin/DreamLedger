#!/usr/bin/env python3
import hashlib, json, time
from CORTEX.redteam.belt_extension import run_extension_belt
from CORTEX.redteam.regression import run_regression

THRESHOLDS = {"promote": 75, "test_review": 60, "kill": 40}

def evaluate(artifact):
    score = int(artifact.get("score", 0))
    if score >= THRESHOLDS["promote"]:
        decision = "PASS"
    elif score >= THRESHOLDS["test_review"]:
        decision = "NEEDS_EVIDENCE"
    elif score >= THRESHOLDS["kill"]:
        decision = "QUARANTINE"
    else:
        decision = "FAIL"

    redteam = None
    regression = {"ok": True, "total": 0, "passed": 0, "failed": []}
    proposal = artifact.get("proposal")
    if isinstance(proposal, dict):
        redteam = run_extension_belt(proposal).to_gauntlet_input()
        regression = run_regression()
        if redteam["critical_findings"]:
            decision = "FAIL"
            score = 0
        elif not regression["ok"]:
            decision = "FAIL"
            score = 0
        else:
            score = max(0, score - int(redteam["score_penalty"]))
            if score >= THRESHOLDS["promote"]:
                decision = "PASS"
            elif score >= THRESHOLDS["test_review"]:
                decision = "NEEDS_EVIDENCE"
            elif score >= THRESHOLDS["kill"]:
                decision = "QUARANTINE"
            else:
                decision = "FAIL"

    payload = {
        "schema": "browneye/gauntlet-result/v2",
        "artifact_id": artifact.get("artifact_id"),
        "job_id": artifact.get("job_id"),
        "silo_id": artifact.get("silo_id", "SILO_GENERAL"),
        "evaluator": "gauntlet",
        "score": score,
        "decision": decision,
        "reasons": artifact.get("reasons", []),
        "evidence_refs": artifact.get("evidence_refs", []),
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "input_hash": artifact.get("input_hash") or hashlib.sha256(json.dumps(artifact, sort_keys=True).encode()).hexdigest(),
        "redteam": redteam,
        "regression": regression,
    }
    payload["output_hash"] = hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()
    return payload

if __name__ == "__main__":
    import sys
    print(json.dumps(evaluate(json.load(sys.stdin)), indent=2))
