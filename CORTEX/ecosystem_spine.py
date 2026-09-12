"""Deterministic ecosystem integrity gate.

This is a control-plane verifier, not an economic actor. It proves that the
replaceable cells of the DreamLedger ecosystem are present and wired without
claiming that external money exists.
"""
from __future__ import annotations
import hashlib
import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]

REQUIRED_FILES = [
    "CORTEX/gauntlet_adapter.py",
    "CORTEX/redteam/belt_extension.py",
    "CORTEX/redteam/contracts.py",
    "CORTEX/redteam/regression.py",
    "CORTEX/test_redteam_extension.py",
    "policy/runtime.cedar",
    "policy/schema.json",
    ".github/workflows/redteam-regression.yml",
    ".github/workflows/cloud-ecosystem-spine.yml",
    ".github/workflows/economic-supervisor.yml",
]

REQUIRED_SYMBOLS = {
    "CORTEX/redteam/belt_extension.py": ["run_extension_belt", "MODULES", "B13_specification_termination", "B24_supply_chain_provenance"],
    "CORTEX/redteam/regression.py": ["add_case", "run_regression"],
    "CORTEX/gauntlet_adapter.py": ["evaluate", "THRESHOLDS"],
}

FORBIDDEN_PATTERNS = [
    "sk-live-",
    "rk_live_",
    "STRIPE_SECRET_KEY=",
    "SUPABASE_SERVICE_ROLE_KEY=",
]


def _sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def verify() -> dict[str, Any]:
    failures: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []
    files: dict[str, Any] = {}

    for rel in REQUIRED_FILES:
        p = ROOT / rel
        if not p.is_file():
            failures.append({"kind": "missing_file", "path": rel})
            continue
        text = p.read_text(encoding="utf-8")
        files[rel] = {"sha256": _sha(p), "bytes": p.stat().st_size}
        for needle in FORBIDDEN_PATTERNS:
            if needle in text:
                failures.append({"kind": "secret_pattern", "path": rel, "pattern": needle})

    for rel, symbols in REQUIRED_SYMBOLS.items():
        p = ROOT / rel
        if not p.is_file():
            continue
        text = p.read_text(encoding="utf-8")
        for symbol in symbols:
            if symbol not in text:
                failures.append({"kind": "missing_symbol", "path": rel, "symbol": symbol})

    policy = ROOT / "policy/runtime.cedar"
    if policy.is_file() and "forbid" not in policy.read_text(encoding="utf-8"):
        failures.append({"kind": "policy", "message": "runtime Cedar policy contains no forbid rule"})

    schema = ROOT / "policy/schema.json"
    if schema.is_file():
        try:
            parsed = json.loads(schema.read_text(encoding="utf-8"))
            actions = parsed.get("DreamLedger", {}).get("actions", {})
            for action in ("send_email", "publish", "charge_card", "refund"):
                if action not in actions:
                    failures.append({"kind": "policy_schema", "message": "missing Cedar action", "action": action})
        except Exception as exc:
            failures.append({"kind": "policy_schema", "message": "invalid JSON schema", "error_type": type(exc).__name__})

    return {
        "schema": "dreamledger/ecosystem-spine/v1",
        "status": "FAIL" if failures else "PASS",
        "failures": failures,
        "warnings": warnings,
        "files": files,
    }


def main() -> int:
    result = verify()
    print(json.dumps(result, indent=2, sort_keys=True))
    return 1 if result["status"] == "FAIL" else 0


if __name__ == "__main__":
    raise SystemExit(main())
