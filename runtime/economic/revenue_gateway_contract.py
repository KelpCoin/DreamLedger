from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Optional


class ServicePromise(str, Enum):
    FULL = "FULL"
    REDUCED = "REDUCED"
    QUEUED = "QUEUED"
    REFUSED = "REFUSED"


class DegradedMode(str, Enum):
    NORMAL = "NORMAL"
    DEGRADED_FALLBACK = "DEGRADED_FALLBACK"
    DEGRADED_QUEUE = "DEGRADED_QUEUE"


class TruthStatus(str, Enum):
    INTERNAL = "INTERNAL"
    TEST = "TEST"


class ContractError(ValueError):
    pass


@dataclass(frozen=True)
class CapabilityFacts:
    database: bool
    storage: bool
    payment_boundary: bool
    fulfillment_worker: bool
    extraction_comparison: bool
    output_generation: bool
    delivery: bool
    fallback_available: bool
    queue_available: bool
    health_fresh: bool
    commercial_contract_aligned: bool


@dataclass(frozen=True)
class GatewayConfig:
    sku: str
    declared_promise: ServicePromise
    fallback_path: Optional[str] = None
    queue_capacity: int = 0
    queue_max_age_seconds: int = 0
    health_ttl_seconds: int = 300


@dataclass(frozen=True)
class GatewayDecision:
    sku: str
    mode: ServicePromise
    can_accept_payment: bool
    degraded_mode: DegradedMode
    reason_code: str
    atomicity_gap: bool
    truth_status: TruthStatus = TruthStatus.INTERNAL
    economic_effect: int = 0


def validate_config(config: GatewayConfig) -> None:
    if not config.sku:
        raise ContractError("SKU_REQUIRED")
    if config.declared_promise == ServicePromise.REDUCED and not config.fallback_path:
        raise ContractError("REDUCED_REQUIRES_FALLBACK")
    if config.declared_promise == ServicePromise.QUEUED:
        if config.queue_capacity <= 0:
            raise ContractError("QUEUED_REQUIRES_QUEUE_CAPACITY")
        if config.queue_max_age_seconds <= 0:
            raise ContractError("QUEUED_REQUIRES_MAX_AGE")
    if config.health_ttl_seconds < 0:
        raise ContractError("HEALTH_TTL_INVALID")


def decide(config: GatewayConfig, facts: CapabilityFacts) -> GatewayDecision:
    validate_config(config)

    if not facts.commercial_contract_aligned:
        return GatewayDecision(
            config.sku, ServicePromise.REFUSED, False, DegradedMode.NORMAL,
            "COMMERCIAL_CONTRACT_CONFLICT", True
        )

    full_capable = all(
        (
            facts.database,
            facts.storage,
            facts.payment_boundary,
            facts.fulfillment_worker,
            facts.extraction_comparison,
            facts.output_generation,
            facts.delivery,
            facts.health_fresh,
        )
    )

    if config.declared_promise == ServicePromise.FULL and full_capable:
        return GatewayDecision(
            config.sku, ServicePromise.FULL, True, DegradedMode.NORMAL,
            "FULFILLMENT_CAPABLE", True
        )

    if config.declared_promise in (ServicePromise.FULL, ServicePromise.REDUCED):
        if facts.fallback_available and facts.health_fresh:
            return GatewayDecision(
                config.sku, ServicePromise.REDUCED, True,
                DegradedMode.DEGRADED_FALLBACK,
                "REDUCED_FALLBACK_CAPABLE", True
            )

    if config.declared_promise == ServicePromise.QUEUED:
        if facts.queue_available and facts.health_fresh:
            return GatewayDecision(
                config.sku, ServicePromise.QUEUED, False,
                DegradedMode.DEGRADED_QUEUE,
                "HUMAN_POLICY_REQUIRED", True
            )

    return GatewayDecision(
        config.sku, ServicePromise.REFUSED, False, DegradedMode.NORMAL,
        "REFUSED_NO_VALID_MODE", True
    )


def as_dict(decision: GatewayDecision) -> dict:
    return {
        "sku": decision.sku,
        "service_promise": decision.mode.value,
        "can_accept_payment": decision.can_accept_payment,
        "degraded_mode": decision.degraded_mode.value,
        "reason_code": decision.reason_code,
        "atomicity_gap": decision.atomicity_gap,
        "truth_status": decision.truth_status.value,
        "economic_effect": decision.economic_effect,
    }


if __name__ == "__main__":
    example = decide(
        GatewayConfig("QUOTE-COMPARE-49", ServicePromise.FULL),
        CapabilityFacts(
            database=True, storage=True, payment_boundary=True,
            fulfillment_worker=True, extraction_comparison=True,
            output_generation=True, delivery=True,
            fallback_available=False, queue_available=False,
            health_fresh=True, commercial_contract_aligned=True,
        ),
    )
    print(as_dict(example))
