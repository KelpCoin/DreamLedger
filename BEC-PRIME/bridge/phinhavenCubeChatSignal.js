'use strict';

/*
 * PhinHaven -> DreamLedger CUBE bridge.
 *
 * This module is intentionally opt-in. The game client calls sendChatSignal()
 * after it accepts a player chat message. It never creates an offer, charges a
 * player, publishes content, or claims economic truth.
 */

const DEFAULT_ENDPOINT = 'https://dreamledger.org/api/cube/chat-signal';

export async function sendChatSignal({
  message,
  siloId = 'phinhaven',
  sessionId = '',
  route = '',
  endpoint = DEFAULT_ENDPOINT
} = {}) {
  const clean = String(message || '').trim().slice(0, 1000);
  if (!clean) return { skipped: true, reason: 'empty_message' };

  const body = JSON.stringify({
    message: clean,
    silo_id: String(siloId || 'phinhaven').slice(0, 120),
    session_id: String(sessionId || '').slice(0, 160),
    route: String(route || '').slice(0, 160)
  });

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        accepted: false,
        status: response.status,
        economic_truth: data.economic_truth || 'NO_SIGNAL_WRITTEN'
      };
    }
    return {
      accepted: Boolean(data.accepted),
      signal_id: data.signal_id || null,
      classification: data.classification || null,
      economic_truth: data.economic_truth || 'SIGNAL_ONLY'
    };
  } catch (error) {
    return {
      accepted: false,
      offline: true,
      error: String(error && error.message ? error.message : error)
    };
  }
}
