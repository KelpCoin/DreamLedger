'use strict';
import { withSupabase } from "npm:@supabase/server@0.9.0";

const CORS = {
  "Access-Control-Allow-Origin": "https://dreamledger.org",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}

function boundedText(value: unknown, max: number, fallback = "") {
  return String(value ?? fallback).trim().slice(0, max);
}

function parseRows(rows: unknown[], ownerId: string) {
  return rows.map((input: any, index: number) => {
    const row = input && typeof input === "object" && !Array.isArray(input) ? input : {};
    const name = boundedText(row.card_name ?? row.name, 200);
    const setCode = boundedText(row.set_code, 16).toLowerCase();
    const collectorNumber = boundedText(row.collector_number, 32);
    const condition = boundedText(row.condition, 40).toUpperCase() || null;
    const language = boundedText(row.language, 16, "en").toLowerCase();
    const finish = boundedText(row.finish, 24, "nonfoil").toLowerCase();
    const rawQuantity = Number(row.quantity ?? 1);
    const quantity = Number.isSafeInteger(rawQuantity) && rawQuantity > 0 ? rawQuantity : 0;
    const price = row.price_nzd === "" || row.price_nzd === null || row.price_nzd === undefined
      ? null
      : Number(row.price_nzd);

    if (!name) throw new Error("row_" + (index + 1) + "_missing_card_name");
    if (quantity < 1) throw new Error("row_" + (index + 1) + "_invalid_quantity");
    if (price !== null && (!Number.isFinite(price) || price < 0 || price > 10000000)) {
      throw new Error("row_" + (index + 1) + "_invalid_price_nzd");
    }

    const fingerprint = [name, setCode, collectorNumber, condition || "", language, finish]
      .join("|").toLowerCase();

    // Do not accept a caller-supplied publication status. The DB default is draft;
    // publication is a separate privileged operation and never follows import.
    return {
      owner_id: ownerId,
      card_name: name,
      set_code: setCode || null,
      collector_number: collectorNumber || null,
      quantity,
      condition,
      language,
      finish,
      price_nzd: price === null ? null : Math.round(price * 100) / 100,
      source: "collection_import",
      fingerprint,
      metadata: { imported_at: new Date().toISOString() },
    };
  });
}

export default {
  fetch: withSupabase({ auth: "user" }, async (req: Request, ctx: any) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
    if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

    const ownerId = String(ctx.userClaims?.sub ?? "");
    if (!ownerId) return json({ error: "authentication_required" }, 401);

    const raw = await req.text();
    if (raw.length > 1_000_000) return json({ error: "request_too_large", max_bytes: 1_000_000 }, 413);

    let body: any;
    try { body = JSON.parse(raw); } catch { return json({ error: "invalid_json" }, 400); }
    const rows = Array.isArray(body?.rows) ? body.rows : [];
    if (rows.length < 1 || rows.length > 2000) {
      return json({ error: "rows_must_be_1_to_2000", max_rows: 2000 }, 400);
    }

    try {
      const clean = parseRows(rows, ownerId);
      const { data, error } = await ctx.supabase
        .from("mtg_collection_inventory")
        .upsert(clean, { onConflict: "owner_id,fingerprint", ignoreDuplicates: false })
        .select("id");
      if (error) {
        console.error("MTG collection import write failed", error.message);
        return json({ error: "collection_import_failed" }, 500);
      }
      return json({ ok: true, imported: data?.length ?? 0, publication: "DRAFT_UNTIL_APPROVED" }, 200);
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : "invalid_import" }, 400);
    }
  }),
};
