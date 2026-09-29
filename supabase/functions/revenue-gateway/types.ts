export type ServicePromise = "FULL" | "REDUCED" | "QUEUED" | "REFUSED";

export type DegradedMode =
  | "NORMAL"
  | "DEGRADED_FALLBACK"
  | "DEGRADED_QUEUE";

export type GatewayDecision =
  | "ACCEPT"
  | "ACCEPT_REDUCED"
  | "HUMAN_POLICY_REQUIRED"
  | "REFUSE";

export type HealthStatus =
  | "UNKNOWN"
  | "REACHABLE"
  | "HEALTHY"
  | "CAPABLE"
  | "FULFILLABLE"
  | "STALE"
  | "FAILED";

export type ReasonCode =
  | "FULFILLMENT_CAPABLE"
  | "REDUCED_FALLBACK_CAPABLE"
  | "QUEUE_CAPABLE"
  | "REFUSED_NO_VALID_MODE"
  | "SKU_NOT_CONFIGURED"
  | "SKU_INACTIVE"
  | "COMMERCIAL_CONTRACT_CONFLICT"
  | "FULFILLMENT_WORKER_UNREACHABLE"
  | "STORAGE_UNAVAILABLE"
  | "DATABASE_UNAVAILABLE"
  | "PAYMENT_BOUNDARY_UNAVAILABLE"
  | "HEALTH_STALE"
  | "ATOMICITY_GAP"
  | "HUMAN_POLICY_REQUIRED"
  | "INVALID_CONFIGURATION";

export type TruthStatus =
  | "VERIFIED"
  | "UNVERIFIED"
  | "CONTRADICTED"
  | "STALE"
  | "TEST"
  | "SIMULATED"
  | "INTERNAL"
  | "UNMATCHED";

export interface GatewayConfig {
  sku: string;
  service_promise: ServicePromise;
  current_mode: ServicePromise;
  degraded_mode: DegradedMode;
  fallback_path: string | null;
  can_accept_payment: boolean;
  expected_delivery: string;
  evidence_required: boolean;
  config_version: number;
  failure_threshold: number;
  sustained_failure_seconds: number;
  health_ttl_seconds: number;
  queue_capacity: number;
  queue_max_age_seconds: number;
  health_summary: Record<string, unknown>;
  last_health_check_at: string | null;
  updated_at: string;
}

export interface CapabilityFacts {
  database: HealthStatus;
  storage: HealthStatus;
  payment_boundary: HealthStatus;
  fulfillment_worker: HealthStatus;
  extraction_comparison: HealthStatus;
  output_generation: HealthStatus;
  delivery: HealthStatus;
  commercial_contract_aligned: boolean;
  health_fresh: boolean;
}

export interface GatewayResponse {
  sku: string;
  decision: GatewayDecision;
  can_accept_payment: boolean;
  service_promise: ServicePromise;
  degraded_mode: DegradedMode;
  expected_delivery: string;
  fallback_path: string | null;
  evidence_required: boolean;
  reason_code: ReasonCode;
  truth_status: TruthStatus;
  capability: CapabilityFacts;
  atomicity_gap: boolean;
  economic_effect: 0;
}
