#!/usr/bin/env python3
import json

from cube_contract_adapter import adapt, sha256_json


CONTRACT = {
    "candidate_id": "cand_quote_compare_49",
    "substrate_requirements": {
        "required_fields": ["2_to_5_quote_documents", "purchase_requirements_or_scope"]
    },
    "transformation": {"name": "QUOTE_COMPARE"}
}


def trace(deliverable):
    return {
        "schema": "dreamledger/cube/cell-trace/v1",
        "trace_schema_version": 1,
        "cell_id": "CELL-A",
        "execution_id": "EXEC-1",
        "task_id": "TASK-1",
        "output_hash": sha256_json(deliverable),
        "evidence_refs": ["evidence://quote-a"],
        "artifact_refs": ["artifact://quote-a"],
        "deliverable": deliverable
    }


def test_ready_when_contract_is_covered():
    result = adapt(trace({
        "quotes": [{"id": "q1"}, {"id": "q2"}],
        "scope": {"currency": "NZD"}
    }), CONTRACT)
    assert result["status"] == "READY"
    assert result["deterministic_input"]["inputs"]["2_to_5_quote_documents"]
    assert result["contract_coverage"]["missing_clause_count"] == 0


def test_blocks_missing_contract_field():
    result = adapt(trace({"quotes": [{"id": "q1"}, {"id": "q2"}]}), CONTRACT)
    assert result["status"] == "BLOCKED"
    assert result["missing"] == ["purchase_requirements_or_scope"]


def test_hash_is_stable():
    d = {"quotes": [{"id": "q1"}]}
    assert sha256_json(d) == sha256_json({"quotes": [{"id": "q1"}]})
