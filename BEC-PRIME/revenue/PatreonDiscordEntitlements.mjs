/**
 * Deterministic Patreon-to-Discord entitlement planner.
 *
 * This module computes desired role changes only. It deliberately performs no network
 * calls and cannot grant roles until a verified Patreon adapter, authorized Discord bot,
 * durable idempotency store, and reconciliation worker are configured.
 */
export const TIER_ROLE_MAP = Object.freeze({
  WATCH: 'DreamLedger Watch',
  SIGNAL: 'DreamLedger Signal',
  GUARD: 'DreamLedger Guard'
});

const ACTIVE_STATES = new Set(['active', 'paid', 'trialing']);
const REVOKED_STATES = new Set([
  'inactive', 'cancelled', 'canceled', 'expired', 'refunded', 'chargeback',
  'declined', 'paused', 'suspended', 'deleted'
]);

function asDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function planEntitlementSync(input, options = {}) {
  const now = asDate(options.now ?? new Date());
  if (!now) throw new TypeError('now must be a valid date');
  if (!input || typeof input !== 'object') throw new TypeError('membership event is required');

  const eventId = String(input.eventId ?? '').trim();
  const memberId = String(input.memberId ?? '').trim();
  if (!eventId) return { verdict: 'QUARANTINE', reason: 'MISSING_EVENT_ID', actions: [] };
  if (!memberId) return { verdict: 'QUARANTINE', reason: 'MISSING_MEMBER_ID', eventId, actions: [] };

  const status = String(input.membershipStatus ?? '').trim().toLowerCase();
  const tierId = String(input.tierId ?? '').trim().toUpperCase();
  const periodEnd = asDate(input.periodEnd);
  const existingRoles = new Set(Array.isArray(input.existingRoles) ? input.existingRoles : []);
  const configuredMap = options.tierRoleMap ?? TIER_ROLE_MAP;

  if (!ACTIVE_STATES.has(status) && !REVOKED_STATES.has(status)) {
    return { verdict: 'QUARANTINE', reason: 'UNKNOWN_MEMBERSHIP_STATE', eventId, memberId, actions: [] };
  }

  let desiredRole = null;
  if (ACTIVE_STATES.has(status)) {
    if (!Object.hasOwn(configuredMap, tierId)) {
      return { verdict: 'QUARANTINE', reason: 'UNKNOWN_TIER', eventId, memberId, actions: [] };
    }
    if (!periodEnd) {
      return { verdict: 'QUARANTINE', reason: 'MISSING_OR_INVALID_PERIOD_END', eventId, memberId, actions: [] };
    }
    if (periodEnd.getTime() <= now.getTime()) {
      return {
        verdict: 'READY',
        eventId,
        memberId,
        desiredTier: null,
        actions: [...existingRoles].filter(role => Object.values(configuredMap).includes(role)).map(role => ({ type: 'REMOVE_ROLE', role }))
      };
    }
    desiredRole = configuredMap[tierId];
  }

  const knownRoles = new Set(Object.values(configuredMap));
  const actions = [];
  for (const role of existingRoles) {
    if (knownRoles.has(role) && role !== desiredRole) actions.push({ type: 'REMOVE_ROLE', role });
  }
  if (desiredRole && !existingRoles.has(desiredRole)) actions.push({ type: 'ADD_ROLE', role: desiredRole });

  return {
    verdict: 'READY',
    eventId,
    memberId,
    desiredTier: desiredRole ? tierId : null,
    periodEnd: periodEnd?.toISOString() ?? null,
    actions
  };
}

/**
 * Caller must persist eventId before executing actions and treat duplicate eventIds
 * as no-ops. A real adapter must verify Patreon authenticity and Discord authorization.
 */
export function idempotencyKey(event) {
  const eventId = String(event?.eventId ?? '').trim();
  const memberId = String(event?.memberId ?? '').trim();
  if (!eventId || !memberId) return null;
  return `patreon-discord:${memberId}:${eventId}`;
}
