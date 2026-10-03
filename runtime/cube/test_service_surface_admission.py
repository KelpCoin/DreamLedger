from service_surface_admission import admit


def test_complete_automatic_surface_is_admitted():
    result = admit({
        "service_id": "SURFACE-1",
        "capability_id": "STRIPE_RECONCILIATION",
        "automation": "FULL",
        "automated_delivery_allowed": True,
        "human_gate_required": False,
        "inputs": ["stripe_export"],
        "outputs": ["reconciliation_report"],
        "validation": ["row_counts"],
        "economic_path": [
            "BUYER",
            "PAYMENT_SETTLED",
            "ENTITLEMENT",
            "SERVICE_WALL",
            "EXISTING_CAPABILITY",
            "RESULT",
            "EVIDENCE",
        ],
    })
    assert result["status"] == "ADMITTED_CANDIDATE"
    assert result["revenue_truth"] == "NOT_ASSERTED"


def test_human_gate_cannot_hide_inside_automatic_surface():
    result = admit({
        "service_id": "SURFACE-2",
        "capability_id": "COMMERCIAL_TRUTH_REVIEW",
        "automation": "PARTIAL",
        "automated_delivery_allowed": True,
        "human_gate_required": True,
        "inputs": ["claim"],
        "outputs": ["review"],
        "validation": ["scope"],
        "economic_path": [
            "BUYER",
            "PAYMENT_SETTLED",
            "ENTITLEMENT",
            "SERVICE_WALL",
            "EXISTING_CAPABILITY",
            "RESULT",
            "EVIDENCE",
        ],
    })
    assert result["status"] == "BLOCKED"
    assert "automated_delivery_conflicts_with_human_gate" in result["failures"]


def test_missing_wall_stage_blocks_candidate():
    result = admit({
        "service_id": "SURFACE-3",
        "capability_id": "X",
        "automation": "FULL",
        "automated_delivery_allowed": True,
        "human_gate_required": False,
        "inputs": ["x"],
        "outputs": ["y"],
        "validation": ["z"],
        "economic_path": ["BUYER", "RESULT"],
    })
    assert result["status"] == "BLOCKED"
    assert "economic_path_must_match_existing_wall_contract" in result["failures"]
