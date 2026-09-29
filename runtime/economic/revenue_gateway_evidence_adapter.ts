/**
 * Evidence adapter boundary.
 *
 * ADAPTER_PENDING_LIVE_SCHEMA
 * The live schema contains multiple evidence/control structures, but this
 * bundle does not assume which one is authoritative for gateway events.
 * Do not connect this interface to a table until the live operator proves
 * the target schema and write semantics.
 */

export type GatewayEvent = {
  event_type: string;
  sku: string;
  decision: string;
  reason_code: string;
  truth_status: "INTERNAL" | "UNVERIFIED" | "TEST";
  observed_at: string;
  metadata?: Record<string, unknown>;
};

export async function emitGatewayEvent(_event: GatewayEvent): Promise<{
  emitted: false;
  status: "ADAPTER_PENDING_LIVE_SCHEMA";
  economic_effect: 0;
}> {
  return {
    emitted: false,
    status: "ADAPTER_PENDING_LIVE_SCHEMA",
    economic_effect: 0,
  };
}
