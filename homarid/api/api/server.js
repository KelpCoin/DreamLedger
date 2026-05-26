// ================================================================
// HAPPY HOMARID  SEALED PRODUCTION SERVER (ALL PATCHES APPLIED)
// ================================================================
const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const crypto = require("crypto");
const { rankListings } = require("./scoring-engine");

// [SEAL] Env validation
function requireEnv(name) {
  if (!process.env[name]) throw new Error(`Missing environment variable: ${name}`);
}
["SUPABASE_URL","SUPABASE_SERVICE_KEY","STRIPE_SECRET_KEY","STRIPE_WEBHOOK_SECRET","PUBLIC_URL"].forEach(requireEnv);

// ---------- GLOBAL INIT ----------
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const app = express();

// ---------- WEBHOOK (raw body, idempotent, payment event ledger) ----------
app.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) { return res.status(400).send(`Webhook Error: ${err.message}`); }

  const providerEventId = event.id;
  const { data: existing } = await supabase
    .from("payment_events")
    .select("id")
    .eq("provider", "stripe")
    .eq("provider_event_id", providerEventId)
    .maybeSingle();
  if (existing) return res.json({ ok: true, deduped: true });

  await supabase.from("payment_events").insert({
    provider: "stripe",
    provider_event_id: providerEventId,
    type: event.type,
    payload_hash: crypto.createHash("sha256").update(JSON.stringify(event)).digest("hex"),
    status: "PROCESSED",
    processed_at: new Date().toISOString()
  });

  if (event.type === "checkout.session.completed") {
    const { listing_id, user_id: buyerId } = event.data.object.metadata;
    const { error } = await supabase.from("boosts").insert({
      listing_id: listing_id,
      user_id: buyerId,
      amount_paid: 2.99,
      expires_at: new Date(Date.now() + 86400000).toISOString(),
      stripe_event_id: providerEventId
    });
    if (error && error.code !== "23505") return res.status(500).json({ error: error.message });

    await supabase.from("listings")
      .update({ state: "BOOSTED", updated_at: new Date() })
      .eq("id", listing_id)
      .eq("state", "ACTIVE");

    await supabase.from("audit_log").insert({
      entity_type: "listing",
      entity_id: listing_id,
      action: "BOOST",
      before: { state: "ACTIVE" },
      after: { state: "BOOSTED" },
      actor_id: buyerId
    });
  }
  res.json({ received: true });
});

// ---------- MIDDLEWARE ----------
app.use(cors({ origin: process.env.PUBLIC_URL || true, credentials: true }));
app.use(express.json({ limit: "1mb" }));

// ---------- AUTH ----------
async function authenticate(req, res, next) {
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Missing token" });
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: "Invalid token" });
  req.user = user;
  next();
}

// ---------- DBBACKED RATE LIMITER ----------
async function rateLimit(userId, action, max = 5, windowMs = 60000) {
  const now = Date.now();
  const { data } = await supabase
    .from("rate_limits")
    .select("*")
    .eq("user_id", userId)
    .eq("action", action)
    .maybeSingle();
  if (!data) {
    await supabase.from("rate_limits").insert({ user_id: userId, action, count: 1, window_start: now });
    return false;
  }
  if (now - data.window_start > windowMs) {
    await supabase.from("rate_limits").update({ count: 1, window_start: now }).eq("user_id", userId).eq("action", action);
    return false;
  }
  if (data.count >= max) return true;
  await supabase.from("rate_limits").update({ count: data.count + 1 }).eq("user_id", userId).eq("action", action);
  return false;
}

// ---------- HEALTH ----------
app.get("/health", async (_, res) => {
  let db = false;
  try { await supabase.from("listings").select("id").limit(1); db = true; } catch(e) {}
  res.json({ ok: true, db, stripe: true });
});

// ---------- MTG GATE ----------
const MTG = ["mtg","commander","edh","modern","legacy","standard","pioneer","pauper","vintage","deck","card","booster","foil","mana","spell"];
function isMTG(text = "") { return MTG.some(k => text.toLowerCase().includes(k)); }

// ---------- CREATE LISTING (ratelimited) ----------
app.post("/api/listing", authenticate, async (req, res) => {
  if (await rateLimit(req.user.id, "create_listing", 5, 60000))
    return res.status(429).json({ error: "Too many listings. Wait a minute." });
  const { title, description, price, format, image_url } = req.body;
  if (!isMTG(title + description)) return res.status(400).json({ error: "Non-MTG content" });
  const { data, error } = await supabase
    .from("listings")
    .insert({ title, description, price, format, image_url, user_id: req.user.id, state: "ACTIVE" })
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true, data });
});

// ---------- BOOST (ownership verified) ----------
app.post("/api/boost", authenticate, async (req, res) => {
  const { listing_id } = req.body;
  const { data: listing } = await supabase.from("listings").select("user_id").eq("id", listing_id).single();
  if (!listing || listing.user_id !== req.user.id) return res.status(403).json({ error: "Not your listing" });
  const session = await stripe.checkout.sessions.create({
    mode: "payment", payment_method_types: ["card"],
    line_items: [{ price_data: { currency: "nzd", product_data: { name: "Listing Boost" }, unit_amount: 299 }, quantity: 1 }],
    metadata: { listing_id, user_id: req.user.id },
    success_url: process.env.PUBLIC_URL, cancel_url: process.env.PUBLIC_URL
  });
  res.json({ url: session.url });
});

// ---------- FEED (scoringengine, brain fallback, hard caps) ----------
app.get("/api/feed", async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);
  const { data: listings, count } = await supabase
    .from("listings")
    .select("*", { count: "exact" })
    .in("state", ["ACTIVE","BOOSTED"])
    .order("created_at", { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  const { data: activeBoosts } = await supabase.from("boosts").select("listing_id").gte("expires_at", new Date().toISOString());
  const boostedSet = new Set((activeBoosts || []).map(b => b.listing_id));

  const sellerIds = [...new Set((listings || []).map(l => l.user_id))];
  const { data: reps } = await supabase.from("users").select("id, email, reputation_score, trades_completed").in("id", sellerIds);
  const reputationMap = {}, salesMap = {}, emailMap = {};
  for (const r of reps || []) {
    reputationMap[r.id] = r.reputation_score || 250;
    salesMap[r.id] = r.trades_completed || 0;
    emailMap[r.id] = r.email || "Seller";
  }

  let brainAlloc = {};
  try {
    if (process.env.BRAIN_MODE === "LOCAL" && process.env.BRAIN_PATH) {
      const brainData = JSON.parse(fs.readFileSync(process.env.BRAIN_PATH, "utf8"));
      brainAlloc = Object.fromEntries((brainData.allocations || []).map(a => [a.listingId, a]));
    }
  } catch (e) {
    console.log("[BRAIN] fallback active (no local data)");
  }

  const enriched = (listings || []).map(l => ({
    ...l,
    seller_email: emailMap[l.user_id] || "Seller",
    seller_reputation: reputationMap[l.user_id] || 250,
    seller_trades: salesMap[l.user_id] || 0
  }));

  const ranked = rankListings(enriched, boostedSet, reputationMap, brainAlloc);
  res.json({ data: ranked, page, limit, total: count });
});

// ---------- OFFER / ACCEPT / CONFIRM / EXTERNAL DEAL ----------
app.post("/api/offer", authenticate, async (req, res) => {
  const { listing_id, price } = req.body;
  const { data: listing } = await supabase.from("listings").select("user_id").eq("id", listing_id).single();
  if (!listing) return res.status(404).json({ error: "Listing not found" });
  if (listing.user_id === req.user.id) return res.status(400).json({ error: "Cannot offer on own listing" });
  const { error } = await supabase.from("offers").insert({ listing_id, user_id: req.user.id, price });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

app.post("/api/offer/accept", authenticate, async (req, res) => {
  const { listing_id, offer_id } = req.body;
  const { data: listing } = await supabase.from("listings").select("user_id").eq("id", listing_id).single();
  if (!listing || listing.user_id !== req.user.id) return res.status(403).json({ error: "Not owner" });
  const { error: offerErr } = await supabase.from("offers").update({ status: "ACCEPTED" }).eq("id", offer_id);
  if (offerErr) return res.status(500).json({ error: offerErr.message });
  const { data: accepted } = await supabase.from("offers").select("user_id, price").eq("id", offer_id).single();
  await supabase.from("transactions").insert({
    listing_id, buyer_id: accepted.user_id, seller_id: req.user.id, price: accepted.price, status: "PENDING"
  });
  await supabase.from("listings").update({ state: "SOLD" }).eq("id", listing_id);
  res.json({ ok: true });
});

app.post("/api/transaction/confirm", authenticate, async (req, res) => {
  const { transaction_id } = req.body;
  const { data: txn } = await supabase.from("transactions").select("*").eq("id", transaction_id).single();
  if (!txn) return res.status(404).json({ error: "Not found" });
  if (txn.buyer_id !== req.user.id && txn.seller_id !== req.user.id) return res.status(403).json({ error: "Not party" });
  await supabase.from("transactions").update({ status: "CONFIRMED" }).eq("id", transaction_id);
  await supabase.rpc("increment_trade_reputation", { buyer_id: txn.buyer_id, seller_id: txn.seller_id });
  res.json({ ok: true });
});

// ---------- EXTERNAL DEAL (close outside platform) ----------
app.post("/api/close-external", authenticate, async (req, res) => {
  const { listing_id, price } = req.body;
  const { data: listing } = await supabase.from("listings").select("user_id").eq("id", listing_id).single();
  if (!listing || listing.user_id !== req.user.id) return res.status(403).json({ error: "Not owner" });
  await supabase.from("external_deals").insert({
    listing_id,
    user_id: req.user.id,
    price: price || null
  });
  await supabase.from("listings").update({
    external_closed: true,
    external_price: price || null,
    external_confirmed: false,
    state: "SOLD"
  }).eq("id", listing_id);
  res.json({ ok: true });
});

// ---------- SHARE ----------
app.get("/api/share/:id", async (req, res) => {
  const { data } = await supabase.from("listings").select("*").eq("id", req.params.id).single();
  if (!data) return res.status(404).json({ error: "Not found" });
  res.json({ text: ` MTG LISTING (NZ)\n${data.title}\nFormat: ${data.format}\nPrice: NZD $${data.price}\n${data.description||""}\nView: ${process.env.PUBLIC_URL}/listing/${data.id}` });
});

const PORT = process.env.PORT || 7070;
app.listen(PORT, () => console.log(`API ready on :${PORT}`));
