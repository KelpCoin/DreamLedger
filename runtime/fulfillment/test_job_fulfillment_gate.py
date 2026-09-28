#!/usr/bin/env python3
from pathlib import Path
from job_fulfillment_gate import evaluate_job, load_registry

ROOT = Path(__file__).parent
REGISTRY = load_registry(ROOT / "capability_registry.json")

def test_full_fulfillment():
    result = evaluate_job({"job_id":"cmd-1","required_capabilities":["COMMANDER_DIAGNOSTIC"]}, REGISTRY)
    assert result["verdict"] == "CAN_FULFILL"
    assert result["automation_level"] == "FULL"

def test_partial_fulfillment_requires_human():
    result = evaluate_job({"job_id":"acnc-contacts-1","required_capabilities":["ACNC_CHARITY_CONTACTS"]}, REGISTRY)
    assert result["verdict"] == "CAN_PARTIALLY_FULFILL"
    assert result["automation_level"] == "HUMAN_REQUIRED"

def test_missing_capability_blocks():
    result = evaluate_job({"job_id":"unknown-1","required_capabilities":["INVENTED_CAPABILITY"]}, REGISTRY)
    assert result["verdict"] == "CANNOT_FULFILL"
    assert result["automation_level"] == "NONE"

if __name__ == "__main__":
    test_full_fulfillment()
    test_partial_fulfillment_requires_human()
    test_missing_capability_blocks()
    print("3/3 fulfillment gate tests passed")
