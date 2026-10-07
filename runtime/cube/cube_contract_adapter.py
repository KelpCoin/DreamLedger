#!/usr/bin/env python3
"""Deterministic CUBE cell-trace -> lane-contract adapter.

The adapter is a boundary, not an LLM. It accepts only structured cell output,
checks contract coverage, binds evidence/artifact references, and emits the
deterministic engine input. It never invents missing fields and never promotes
a cell claim into economic truth.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any


TRACE_REQUIRED = (
    "schema",
    "trace_schema_version",
    "cell_id",
    "execution_id",
    "task_id",
    "output_hash",
    "deliverable",
)

DEFAULT_TRACE_SCHEMA = "dreamledger/cube/cell-trace/v1"


def canonical_json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def sha256_json(value: Any) -> str:
    return hashlib.sha256(canonical_json(value).encode("utf-8")).hexdigest()


def _nonempty(value: Any) -> bool:
    return value is not None and value != "" and value != [] and value != {}


def validate_trace(trace: dict[str, Any]) -> list[str]:
    errors = []
    for field in TRACE_REQUIRED:
        if field not in trace:
            errors.append(f"TRACE_MISSING:{field}")
    if trace.get("schema") != DEFAULT_TRACE_SCHEMA:
        errors.append("TRACE_SCHEMA_MISMATCH")
    if trace.get("trace_schema_version") != 1:
        errors.append("TRACE_SCHEMA_VERSION_MISMATCH")
    deliverable = trace.get("deliverable")
    if not isinstance(deliverable, dict):
        errors.append("DELIVERABLE_NOT_OBJECT")
    if not _nonempty(trace.get("output_hash")):
        errors.append("OUTPUT_HASH_MISSING")
    elif trace["output_hash"] != sha256_json(trace.get("deliverable")):
        errors.append("OUTPUT_HASH_MISMATCH")
    hop_count = trace.get("hop_count")
    if hop_count is not None and (not isinstance(hop_count, int) or hop_count < 0 or hop_count > 16):
        errors.append("HOP_COUNT_OUT_OF_RANGE")
    if trace.get("parent_trace_id") and not trace.get("previous_receipt_hash"):
        errors.append("PREVIOUS_RECEIPT_HASH_MISSING")
    return errors


def _required_fields(contract: dict[str, Any]) -> list[str]:
    return list(
        contract.get("substrate_requirements", {}).get("required_fields", [])
    )


def _field_aliases(field: str) -> tuple[str, ...]:
    aliases = {
        "2_to_5_quote_documents": ("quote_documents", "quotes", "quote_docs"),
        "purchase_requirements_or_scope": (
            "purchase_requirements",
            "requirements",
            "scope",
        ),
        "source_quote": ("source_quote", "quote"),
        "supplier_invoice": ("supplier_invoice", "invoice"),
        "purchase_order": ("purchase_order", "po"),
    }
    return aliases.get(field, (field,))


def _resolve(deliverable: dict[str, Any], field: str) -> tuple[Any, str | None]:
    for candidate in _field_aliases(field):
        if _nonempty(deliverable.get(candidate)):
            return deliverable[candidate], candidate
    return None, None


def adapt(trace: dict[str, Any], contract: dict[str, Any]) -> dict[str, Any]:
    errors = validate_trace(trace)
    if errors:
        raise ValueError(";".join(errors))

    deliverable = trace["deliverable"]
    required = _required_fields(contract)
    bindings: list[dict[str, Any]] = []
    missing: list[str] = []
    covered_source_fields: set[str] = set()

    for clause_id, field in enumerate(required, start=1):
        value, source_key = _resolve(deliverable, field)
        if source_key is None:
            missing.append(field)
            continue
        covered_source_fields.add(source_key)
        bindings.append({
            "clause_id": f"REQ-{clause_id:03d}",
            "contract_field": field,
            "deliverable_field": source_key,
            "covered": True,
            "value_hash": sha256_json(value),
        })

    # Evidence is referenced, never trusted merely because a cell supplied it.
    evidence_refs = trace.get("evidence_refs", [])
    artifact_refs = trace.get("artifact_refs", [])
    if not isinstance(evidence_refs, list) or not isinstance(artifact_refs, list):
        raise ValueError("EVIDENCE_OR_ARTIFACT_REFS_NOT_LIST")

    # ZFT-style reverse coverage: every deliverable element must be justified
    # by a declared contract field. This prevents silent scope creep.
    unbound_deliverable_fields = sorted(set(deliverable) - covered_source_fields)

    coverage = {
        "required_clause_count": len(required),
        "covered_clause_count": len(bindings),
        "missing_clause_count": len(missing),
        "bidirectional_scope_ok": bool(required and not missing) if required else True,
        "missing_contract_fields": missing,
        "unbound_deliverable_fields": unbound_deliverable_fields,
        "reverse_coverage_ok": not unbound_deliverable_fields,
    }

    deterministic_input = {
        "schema": "dreamledger/cube/deterministic-input/v1",
        "schema_version": 1,
        "contract_id": contract.get("candidate_id") or contract.get("schema"),
        "transformation": contract.get("transformation", {}).get("name"),
        "trace_ref": {
            "cell_id": trace["cell_id"],
            "execution_id": trace["execution_id"],
            "task_id": trace["task_id"],
            "output_hash": trace["output_hash"],
        },
        "inputs": {
            field: _resolve(deliverable, field)[0]
            for field in required
            if _resolve(deliverable, field)[1] is not None
        },
        "evidence_refs": evidence_refs,
        "artifact_refs": artifact_refs,
        "contract_coverage": coverage,
    }

    result = {
        "adapter_schema": "dreamledger/cube/contract-adapter/v1",
        "adapter_version": 1,
        "status": "READY" if not missing and not unbound_deliverable_fields else "BLOCKED",
        "trace_schema_version": trace["trace_schema_version"],
        "contract": contract.get("candidate_id") or contract.get("schema"),
        "bindings": bindings,
        "missing": missing,
        "unbound_deliverable_fields": unbound_deliverable_fields,
        "deterministic_input": deterministic_input,
    }
    result["adapter_hash"] = sha256_json(result)
    return result


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--trace", required=True)
    parser.add_argument("--contract", required=True)
    parser.add_argument("--output")
    args = parser.parse_args()

    trace = json.loads(Path(args.trace).read_text(encoding="utf-8"))
    contract = json.loads(Path(args.contract).read_text(encoding="utf-8"))
    result = adapt(trace, contract)
    rendered = json.dumps(result, indent=2, sort_keys=True) + "\n"
    if args.output:
        Path(args.output).write_text(rendered, encoding="utf-8")
    else:
        print(rendered, end="")
    return 0 if result["status"] == "READY" else 2


if __name__ == "__main__":
    raise SystemExit(main())
