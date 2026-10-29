// Single-event claim for Stripe webhooks. Does not call Stripe or perform fulfilment.
// Event-ID uniqueness in stripe_webhook_events is a database prerequisite.
// An unfinished claim deliberately remains pending (503/retry), NOT silently marked successful.
// Recovery of pending claims needs an audited operator/outbox process before production release.
export async function claimWebhookEvent(db,event) {
  if (!event || typeof event.id !== "string" || !/^evt_[A-Za-z0-9]+$/.test(event.id) ||
      typeof event.type !== "string" || !event.type) {
    return {kind:"invalid"};
  }
  const {error:insertError}=await db.from("stripe_webhook_events").insert({
    event_id:event.id,
    event_type:event.type,
    processed:false,
    processed_at:null,
    payload:event
  });
  if (!insertError) return {kind:"claimed"};
  // PostgreSQL unique_violation. Any other insert error must NOT be called a duplicate.
  if (insertError.code!=="23505") return {kind:"storage_error"};
  const {data:existing,error:lookupError}=await db.from("stripe_webhook_events")
    .select("event_id,processed").eq("event_id",event.id).maybeSingle();
  if (lookupError || !existing) return {kind:"storage_error"};
  return existing.processed===true?{kind:"duplicate"}:{kind:"pending"};
}
