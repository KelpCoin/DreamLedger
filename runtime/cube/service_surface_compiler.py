"""Deterministic compiler for packaging existing DreamLedger capabilities as customer-facing surfaces.

Pure module. No network, DB, Stripe, queue, model, or external action.
It inventories only what existing capability/lane contracts already expose.

This is NOT an economic ledger and does not assert demand, payment, fulfillment,
or revenue. It produces candidate packaging records that must still pass the
existing economic-surface-factory admission rules.
"""

from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Any, Iterable, Mapping
import hashlib
import json


@dataclass(frozen=True)
class Surface:
    service_id: str
    capability_id: str
    lane_id: str | None
    description: str
    automation: str
    automated_delivery_allowed: bool
    human_gate_required: bool
    human_gate_reason: str | None
    inputs: tuple[str, ...]
    outputs: tuple[str, ...]
    validation: tuple[str, ...]
    external_gates: tuple[str, ...]
    price_hint: int | float | None
    status: str
    economic_path: tuple[str, ...]


def _slug(value: str) -> str:
    return "".join(c.lower() if c.isalnum() else "-" for c in value).strip("-")


def _stable_id(capability_id: str, lane_id: str | None) -> str:
    raw = f"{capability_id}|{lane_id or ''}".encode("utf-8")
    return "SURFACE-" + hashlib.sha256(raw).hexdigest()[:12].upper()


def _lane_for_capability(
    capability_id: str, lanes: Iterable[Mapping[str, Any]]
) -> Mapping[str, Any] | None:
    # Existing economic_surface_factory uses [lane_id, family, transformation, price, status].
    for lane in lanes:
        if isinstance(lane, (list, tuple)) and len(lane) >= 5:
            lane_id, _family, transformation, price, status = lane[:5]
            if capability_id.lower() in str(transformation).lower():
                return {
                    "lane_id": lane_id,
                    "transformation": transformation,
                    "price": price,
                    "status": status,
                }
    return None


def compile_surface(
    capability: Mapping[str, Any],
    lanes: Iterable[Mapping[str, Any]] = (),
) -> Surface:
    capability_id = str(capability["id"])
    automation = str(capability.get("automation", "UNKNOWN")).upper()
    external_gates = tuple(str(x) for x in capability.get("external_gates", []))
    inputs = tuple(str(x) for x in capability.get("inputs", []))
    outputs = tuple(str(x) for x in capability.get("outputs", []))
    validation = tuple(str(x) for x in capability.get("validation", []))

    lane = _lane_for_capability(capability_id, lanes)
    lane_id = str(lane["lane_id"]) if lane else None
    price = lane.get("price") if lane else None

    # Automation is allowed when the capability registry itself says FULL and
    # there is no external authority gate. PARTIAL is never silently promoted.
    human_gate_required = bool(external_gates)
    automated_delivery_allowed = automation == "FULL" and not human_gate_required

    if human_gate_required:
        status = "AUTHORITY_BLOCKED"
        reason = ",".join(external_gates)
    elif automation != "FULL":
        status = "DEPENDENCY_BLOCKED"
        reason = "capability_registry_automation_not_full"
    elif lane and str(lane["status"]).upper() in {"LIVE RAIL", "ARMED"}:
        status = "READY_FOR_SERVICE"
        reason = None
    else:
        status = "READY_FOR_ENTITLEMENT"
        reason = None

    description = (
        f"Customer-facing bounded service for {capability_id}; "
        f"existing capability only, with deterministic delivery policy."
    )

    return Surface(
        service_id=_stable_id(capability_id, lane_id),
        capability_id=capability_id,
        lane_id=lane_id,
        description=description,
        automation=automation,
        automated_delivery_allowed=automated_delivery_allowed,
        human_gate_required=human_gate_required,
        human_gate_reason=reason,
        inputs=inputs,
        outputs=outputs,
        validation=validation,
        external_gates=external_gates,
        price_hint=price,
        status=status,
        economic_path=(
            "BUYER",
            "PAYMENT_SETTLED",
            "ENTITLEMENT",
            "SERVICE_WALL",
            "EXISTING_CAPABILITY",
            "RESULT",
            "EVIDENCE",
        ),
    )


def compile_registry(
    registry: Mapping[str, Any],
    factory: Mapping[str, Any],
) -> list[dict[str, Any]]:
    """Compile existing capability inventory into reusable surface candidates."""
    lanes = factory.get("existing_lanes", [])
    capabilities = registry.get("capabilities", [])
    return [asdict(compile_surface(c, lanes)) for c in capabilities]


def canonical_json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
