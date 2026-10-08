import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ORIGIN = "https://dreamledger.org";
const CORS = {
  "Access-Control-Allow-Origin": ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store"
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}

function clean(value: unknown, max: number) {
  return String(value ?? "").trim().slice(0, max);
}

function parseDecklist(text: string) {
  const lines = text.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  const cards = new Map<string, number>();
  let cardCount = 0;
  for (const raw of lines) {
    const line = raw
      .replace(/^[-*]\s*/, "")
      .replace(/^\[[^\]]+\]\s*$/, "");
    const match = line.match(/^(\d+)\s*x?\s+(.+)$/i);
    if (!match) continue;
    const qty = Math.max(1, Number(match[1]));
    const name = clean(match[2].replace(/\s+\(.*\)$/, ""), 200);
    if (!name) continue;
    cardCount += qty;
    cards.set(name.toLowerCase(), (cards.get(name.toLowerCase()) || 0) + qty);
  }
  return { cardCount, uniqueCardCount: cards.size };
}

function slugFrom(title: string, id: string) {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70);
  return (slug || "commander-deck") + "-" + id.slice(0, 8);
}

function copyFor(deck: {
  id: string; title: string; commander: string; price_nzd: number; description: string; slug: string;
}) {
  const url = "https://dreamledger.org/mtg/?deck=" + encodeURIComponent(deck.slug);
  const fb = [
    "NEW COMMANDER DECK",
    "",
    deck.title,
    "Commander: " + deck.commander,
    "NZ$" + Number(deck.price_nzd).toFixed(2),
    "",
    deck.description || "Real physical Commander deck listed on DreamLedger.",
    "",
    url
  ].join("\n");
  const patreon = [
    "NEW DECK DROP",
    "",
    deck.title,
    "Commander: " + deck.commander,
    "NZ$" + Number(deck.price_nzd).toFixed(2),
    "",
    "New physical MTG inventory is live on DreamLedger.",
    url
  ].join("\n");
  return { facebook: fb, patreon };
}

function adminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  let serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SECRET_KEY");
  if (!serviceKey) {
    try { serviceKey = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}").default; } catch {}
  }
  if (!url || !serviceKey) throw new Error("server_configuration_incomplete");
  return createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function authenticatedUser(req: Request) {
  const url = Deno.env.get("SUPABASE_URL");
  const publicKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const authHeader = req.headers.get("Authorization") || "";
  if (!url || !publicKey || !authHeader.startsWith("Bearer ")) return null;
  const client = createClient(url, publicKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: { user }, error } = await client.auth.getUser();
  return error || !user ? null : user;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  let admin;
  try {
    admin = adminClient();
  } catch (error) {
    return json({ error: String(error instanceof Error ? error.message : error) }, 500);
  }

  if (req.method === "GET") {
    const { data, error } = await admin
      .from("mtg_decks")
      .select("id,title,commander,description,condition,price_nzd,inventory,card_count,unique_card_count,image_url,status,published_at,created_at,updated_at,social_copy,metadata")
      .eq("status", "published")
      .gt("inventory", 0)
      .order("published_at", { ascending: false });
    if (error) return json({ error: error.message }, 500);
    return json({ schema: "DREAMLEDGER/MTG-DECK-CATALOG/v1", decks: data || [] });
  }

  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const user = await authenticatedUser(req);
  if (!user) return json({ error: "authentication_required" }, 401);

  const body = await req.json().catch(() => ({}));
  const title = clean(body.title, 160);
  const commander = clean(body.commander, 160);
  const description = clean(body.description, 2000);
  const condition = clean(body.condition || "Unspecified", 60);
  const price = Number(body.price_nzd);
  const inventory = Math.max(0, Math.floor(Number(body.inventory ?? 1)));
  const decklist = clean(body.decklist_text, 200000);
  const imageUrl = clean(body.image_url, 1000);
  const publish = body.publish !== false;

  if (!title) return json({ error: "title_required" }, 422);
  if (!commander) return json({ error: "commander_required" }, 422);
  if (!Number.isFinite(price) || price <= 0) return json({ error: "valid_price_required" }, 422);
  if (!inventory) return json({ error: "inventory_must_be_at_least_one" }, 422);
  if (!decklist) return json({ error: "decklist_required" }, 422);

  const parsed = parseDecklist(decklist);
  if (!parsed.cardCount) return json({ error: "decklist_needs_quantity_and_card_lines" }, 422);

  const id = crypto.randomUUID();
  const slug = slugFrom(title, id);
  const base = {
    id,
    owner_id: user.id,
    title,
    commander,
    description,
    condition,
    price_nzd: Math.round(price * 100) / 100,
    inventory,
    decklist_text: decklist,
    card_count: parsed.cardCount,
    unique_card_count: parsed.uniqueCardCount,
    image_url: imageUrl || null,
    status: publish ? "published" : "draft",
    source: "mtg_deck_upload",
    metadata: { uploader_email: user.email || null, slug },
    published_at: publish ? new Date().toISOString() : null
  };

  const social = copyFor({ ...base, slug });
  const { data, error } = await admin
    .from("mtg_decks")
    .insert({ ...base, social_copy: social })
    .select("id,title,commander,description,condition,price_nzd,inventory,card_count,unique_card_count,image_url,status,published_at,created_at,updated_at,social_copy,metadata")
    .single();

  if (error) return json({ error: error.message }, 500);

  return json({
    ok: true,
    deck: data,
    public_url: publish ? "https://dreamledger.org/mtg/?deck=" + encodeURIComponent(slug) : null,
    distribution: {
      facebook: social.facebook,
      patreon: social.patreon,
      rule: "COPY_ONLY_UNTIL_EXTERNAL_CHANNEL_AUTHORIZATION_EXISTS"
    }
  }, 201);
});
