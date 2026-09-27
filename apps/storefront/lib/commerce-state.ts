export const COMMERCE_ACTION_STATES = [
  "QUEUED",
  "RUNNING",
  "WAITING_APPROVAL",
  "WAITING_EXTERNAL",
  "RETRYING",
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
] as const;

export type CommerceActionState = (typeof COMMERCE_ACTION_STATES)[number];

export const TERMINAL_ACTION_STATES: readonly CommerceActionState[] = [
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
];

export const ALLOWED_TRANSITIONS: Record<CommerceActionState, readonly CommerceActionState[]> = {
  QUEUED: ["RUNNING", "CANCELLED"],
  RUNNING: ["WAITING_APPROVAL", "WAITING_EXTERNAL", "RETRYING", "SUCCEEDED", "FAILED", "CANCELLED"],
  WAITING_APPROVAL: ["RUNNING", "CANCELLED"],
  WAITING_EXTERNAL: ["RUNNING", "RETRYING", "FAILED", "CANCELLED"],
  RETRYING: ["RUNNING", "FAILED", "CANCELLED"],
  SUCCEEDED: [],
  FAILED: [],
  CANCELLED: [],
};

export function assertActionTransition(
  from: CommerceActionState,
  to: CommerceActionState,
): void {
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    throw new Error(`INVALID_ACTION_TRANSITION:${from}->${to}`);
  }
}

export function isTerminalActionState(state: CommerceActionState): boolean {
  return TERMINAL_ACTION_STATES.includes(state);
}
