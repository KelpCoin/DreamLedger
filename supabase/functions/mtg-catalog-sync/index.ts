import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const PUBLIC_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "";
const ALLOWED_ORIGIN = "https://dreamledger.org";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function syncConfig() {
  const adminIds = new Set(
    (Deno.env.get("MTG_CATALOG_SYNC_ADMIN_USER_IDS") ?? "")
      .split(",").map((x) => x.trim()).filter(Boolean),
  );
  const rate = Number(Deno.env.get("USD_NZD_RATE"));
  const rateAsOf = Date.parse(Deno.env.get("USD_NZD_RATE_AS_OF") ?? "");
  const age = Date.now() - rateAsOf;
  const validRate = Number.isFinite(rate) && rate > 0 && Number.isFinite(rateAsOf)
    && age >= 0 && age <= 7 * 24 * 60 * 60 * 1000;
  return { adminIds, rate, rateAsOf, validRate };
}

async function authorizedAdmin(req: Request, adminIds: Set<string>) {
  const header = req.headers.get("Authorization") ?? "";
  if (!header.startsWith("Bearer ") || !SUPABASE_URL || !PUBLIC_KEY) return false;
  const token = header.slice("Bearer ".length).trim();
  if (!token) return false;

  const authClient = createClient(SUPABASE_URL, PUBLIC_KEY, {
    global: { headers: { Authorization: "Bearer " + token } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error } = await authClient.auth.getUser(token);
  return !error && !!user && adminIds.has(user.id);
}

function price(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function toNzd(usd: number | null, fxRate: number): number | null {
  return usd === null ? null : Math.round(usd * fxRate * 100) / 100;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return json({ ok: true });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const config = syncConfig();
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !PUBLIC_KEY || config.adminIds.size === 0 || !config.validRate) {
    return json({
      error: "catalog_sync_configuration_incomplete",
      required: ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_ANON_KEY or SUPABASE_PUBLISHABLE_KEY", "MTG_CATALOG_SYNC_ADMIN_USER_IDS", "fresh USD_NZD_RATE and USD_NZD_RATE_AS_OF"],
    }, 503);
  }

  if (!(await authorizedAdmin(req, config.adminIds))) {
    return json({ error: "catalog_admin_required" }, 403);
  }

  let raw = "";
  try { raw = await req.text(); } catch { return json({ error: "invalid_request_body" }, 400); }
  if (raw.length > 100_000) return json({ error: "request_too_large", max_bytes: 100_000 }, 413);

  let body: any;
  try { body = JSON.parse(raw); } catch { return json({ error: "invalid_json" }, 400); }
  const identifiers = Array.isArray(body?.identifiers) ? body.identifiers : [];
  if (identifiers.length < 1 || identifiers.length > 75) {
    return json({ error: "identifiers_must_be_1_to_75", max: 75 }, 400);
  }
  if (!identifiers.every((x: unknown) => !!x && typeof x === "object" && !Array.isArray(x))) {
    return json({ error: "each_identifier_must_be_an_object" }, 400);
  }

  const scryfall = await fetch("https://api.scryfall.com/cards/collection", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({ identifiers }),
  });
  if (!scryfall.ok) {
    console.error("Scryfall catalog request failed", scryfall.status);
    return json({ error: "scryfall_request_failed", upstream_status: scryfall.status }, 502);
  }

  const payload = await scryfall.json();
  const cards = Array.isArray(payload?.data) ? payload.data : [];
  const observedAt = new Date().toISOString();
  const fxRate = config.rate;
  const fxAsOf = new Date(config.rateAsOf).toISOString();

  const catalogRows = cards.map((card: any) => {
    const prices = card.prices ?? {};
    const usd = price(prices.usd);
    return {
      scryfall_id: card.id,
      oracle_id: card.oracle_id ?? null,
      name: card.name,
      set_code: card.set,
      set_name: card.set_name ?? null,
      collector_number: card.collector_number,
      rarity: card.rarity ?? null,
      mana_cost: card.mana_cost ?? null,
      type_line: card.type_line ?? null,
      oracle_text: card.oracle_text ?? null,
      colors: card.colors ?? [],
      color_identity: card.color_identity ?? [],
      image_uri_small: card.image_uris?.small ?? null,
      image_uri_normal: card.image_uris?.normal ?? null,
      image_uri_art_crop: card.image_uris?.art_crop ?? null,
      image_uri_png: card.image_uris?.png ?? null,
      price_usd: usd,
      price_nzd: toNzd(usd, fxRate),
      price_updated_at: observedAt,
      released_at: card.released_at ?? null,
      raw: { card, fx: { base: "USD", quote: "NZD", rate: fxRate, as_of: fxAsOf } },
    };
  });

  const observationRows = cards.flatMap((card: any) => {
    const prices = card.prices ?? {};
    const variants = [
      { finish: "NONFOIL", usd: price(prices.usd) },
      { finish: "FOIL", usd: price(prices.usd_foil) },
    ];
    return variants.filter((v) => v.usd !== null).map((v) => ({
      scryfall_id: card.id,
      source: "SCRYFALL",
      price_usd: v.usd,
      price_nzd: toNzd(v.usd, fxRate),
      finish: v.finish,
      source_url: card.scryfall_uri ?? null,
      evidence: { set: card.set, collector_number: card.collector_number, fx_rate_usd_nzd: fxRate, fx_rate_as_of: fxAsOf, observed_at: observedAt },
    }));
  });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (catalogRows.length > 0) {
    const { error } = await supabase.from("scryfall_catalog").upsert(catalogRows, { onConflict: "scryfall_id" });
    if (error) {
      console.error("Scryfall catalog upsert failed", error.message);
      return json({ error: "catalog_write_failed" }, 500);
    }
  }

  if (observationRows.length > 0) {
    const { error } = await supabase.from("mtg_price_observations").insert(observationRows);
    if (error) {
      console.error("MTG price-observation insert failed", error.message);
      return json({ error: "price_observation_write_failed", catalog_updated: catalogRows.length }, 500);
    }
  }

  return json({
    ok: true,
    source: "SCRYFALL",
    requested: identifiers.length,
    returned: cards.length,
    not_found: Array.isArray(payload?.not_found) ? payload.not_found : [],
    catalog_upserted: catalogRows.length,
    price_observations_inserted: observationRows.length,
    fx: { base: "USD", quote: "NZD", rate: fxRate, as_of: fxAsOf },
    external_action_performed: false,
    economic_revenue_claimed: false,
  });
});
