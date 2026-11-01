export function verifyMtgTestSession(session: any, order: any, nowMs=Date.now()) {
  if (!session || !order) return false;
  if (!/^cs_test_[A-Za-z0-9_]+$/.test(String(session.id || ''))) return false;
  if (session.livemode !== false || session.status !== 'open' || session.payment_status !== 'unpaid') return false;
  if (session.mode !== 'payment' || session.client_reference_id !== order.id) return false;
  if (session.amount_total !== Number(order.amount_cents) || session.currency !== 'nzd' || order.currency !== 'NZD') return false;
  if (session.metadata?.silo !== 'mtg' || session.metadata?.mtg_order_id !== order.id || session.metadata?.mtg_auction_id !== order.auction_id) return false;
  if (!Number.isSafeInteger(session.expires_at) || session.expires_at <= Math.floor(nowMs / 1000)) return false;
  try { const u = new URL(session.url); if (u.origin !== 'https://checkout.stripe.com' || u.username || u.password) return false; }
  catch { return false; }
  return true;
}
