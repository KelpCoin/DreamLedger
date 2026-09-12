"""Fail-closed production ecosystem verifier.

Checks the canonical registry, required component files, JSON contracts,
Python compilation, and the economic-chain invariants. It never calls Stripe,
mutates Supabase, sends messages, or deploys anything.
"""
from __future__ import annotations
import hashlib
import json
import py_compile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REGISTRY = ROOT / "CORTEX" / "ecosystem_registry.json"


def main() -> int:
    failures = []
    registry = json.loads(REGISTRY.read_text(encoding="utf-8"))
    if registry.get("schema") != "dreamledger/ecosystem-registry/v1":
        failures.append({"kind": "registry_schema"})
    if registry.get("settlement_authority") != "stripe_live":
        failures.append({"kind": "settlement_authority"})
    if registry.get("state_authority") != "supabase":
        failures.append({"kind": "state_authority"})

    files = {}
    for component in registry.get("components", []):
        for rel in component.get("paths", []):
            p = ROOT / rel
            if not p.is_file():
                failures.append({"kind": "missing_component", "component": component.get("id"), "path": rel})
                continue
            digest = hashlib.sha256(p.read_bytes()).hexdigest()
            files[rel] = {"sha256": digest, "bytes": p.stat().st_size}
            if p.suffix == ".json":
                try:
                    json.loads(p.read_text(encoding="utf-8"))
                except Exception as exc:
                    failures.append({"kind": "invalid_json", "path": rel, "error_type": type(exc).__name__})
            if p.suffix == ".py":
                try:
                    py_compile.compile(str(p), doraise=True)
                except Exception as exc:
                    failures.append({"kind": "python_compile", "path": rel, "error_type": type(exc).__name__})

    chain = registry.get("economic_chain", [])
    required_chain = ["buyer", "inventory", "match", "offer", "order", "settlement", "fulfilment", "truth", "reputation", "repeat"]
    if chain != required_chain:
        failures.append({"kind": "economic_chain", "expected": required_chain, "actual": chain})

    output = {
        "schema": "dreamledger/ecosystem-verification/v1",
        "status": "FAIL" if failures else "PASS",
        "failure_count": len(failures),
        "failures": failures,
        "components": len(registry.get("components", [])),
        "files_checked": len(files),
        "files": files,
    }
    print(json.dumps(output, indent=2, sort_keys=True))
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
