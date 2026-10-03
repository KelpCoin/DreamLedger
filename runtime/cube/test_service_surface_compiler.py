import json
from pathlib import Path

from service_surface_compiler import compile_registry, compile_surface


def test_full_capability_without_gate_can_be_automatic():
    surface = compile_surface({
        "id": "STRIPE_RECONCILIATION",
        "automation": "FULL",
        "inputs": ["stripe_export"],
        "outputs": ["reconciliation_report"],
        "validation": ["row_counts"],
        "external_gates": [],
    }, [["LANE-1", "x", "stripe_reconciliation", 49, "LIVE RAIL"]])

    assert surface.automated_delivery_allowed is True
    assert surface.human_gate_required is False
    assert surface.status == "READY_FOR_SERVICE"
    assert surface.economic_path[-1] == "EVIDENCE"


def test_partial_capability_is_not_silently_promoted():
    surface = compile_surface({
        "id": "SELLER_PROFIT_AUDIT",
        "automation": "PARTIAL",
        "inputs": ["seller_export"],
        "outputs": ["profit_audit_report"],
        "validation": ["calculation_reconciliation"],
        "external_gates": ["human_review_when_source_data_ambiguous"],
    })

    assert surface.automated_delivery_allowed is False
    assert surface.human_gate_required is True
    assert surface.status == "AUTHORITY_BLOCKED"


def test_registry_compilation_is_deterministic():
    registry = {
        "capabilities": [{
            "id": "PAID_DIGITAL_DELIVERY",
            "automation": "FULL",
            "inputs": ["settled_payment", "buyer_identity"],
            "outputs": ["paid_artifact"],
            "validation": ["artifact_available"],
            "external_gates": [],
        }]
    }
    factory = {"existing_lanes": []}

    a = compile_registry(registry, factory)
    b = compile_registry(registry, factory)

    assert a == b
    assert a[0]["service_id"].startswith("SURFACE-")


def test_rules_file_is_valid_json():
    path = Path(__file__).with_name("service_surface_rules.json")
    # The rules file lives beside the compiler in runtime/cube.
    if not path.exists():
        path = Path(__file__).parent / "service_surface_rules.json"
    json.loads(path.read_text(encoding="utf-8"))
