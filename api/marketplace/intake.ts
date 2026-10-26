import { neon } from "@neondatabase/serverless";
import { createHash, randomUUID } from "node:crypto";

const categories = new Set([
  "Construction & trade", "IT & hardware", "Freight & logistics",
  "Manufacturing", "Professional services", "MTG wholesale",
  "Retail overstock", "Marketing & events", "Other"
]);
const clean = (value: unknown, max: number) => String(value ?? "").trim().slice(0, max);
const json = (res: any, status: number, body: unknown) => {
  res.status(status).setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.send(JSON.stringify(body));
};
function sameOrigin(req: any) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    const parsed = new URL(origin);
    return parsed.host === String(req.headers.host || "") && ["https:", "http:"].includes(parsed.protocol);
  } catch { return false; }
}
export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return json(res, 405, { error: "METHOD_NOT_ALLOWED" });
  if (!sameOrigin(req)) return json(res, 403, { error: "ORIGIN_NOT_ALLOWED" });
  if (!process.env.NEON_DATABASE_URL) return json(res, 503, { error: "MARKETPLACE_NOT_CONFIGURED" });
  let b: any = req.body;
  if (typeof b === "string") { try { b = JSON.parse(b); } catch { return json(res, 400, { error: "INVALID_JSON" }); } }
  if (!b || typeof b !== "object" || Array.isArray(b)) return json(res, 400, { error: "INVALID_JSON" });
  if (clean(b.website, 200)) return json(res, 202, { ok: true, reference: "received" });
  const company = clean(b.company, 120);
  const email = clean(b.email, 254).toLowerCase();
  const category = clean(b.category, 80);
  const title = clean(b.title, 160);
  const details = clean(b.details, 2000);
  const region = clean(b.region, 120);
  const budget = clean(b.budget, 120);
  const key = clean(b.idempotency_key, 80);
  if (company.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !categories.has(category) || title.length < 5 || details.length < 10 ||
      region.length < 2 || !key || b.contact_consent !== true) {
    return json(res, 422, { error: "CHECK_REQUIRED_FIELDS_AND_CONTACT_CONSENT" });
  }
  try {
    const sql = neon(process.env.NEON_DATABASE_URL);
    const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown").split(",")[0].trim();
    const salt = process.env.RATE_LIMIT_SALT || "dreamledger-rfq-v1";
    const ipHash = createHash("sha256").update(ip + "|" + salt).digest("hex");
    const windowStart = new Date(Math.floor(Date.now() / 3600000) * 3600000).toISOString();
    const limit = await sql`insert into marketplace.intake_rate_limits(ip_hash,window_start,request_count)
      values(${ipHash},${windowStart},1)
      on conflict(ip_hash,window_start) do update
      set request_count=marketplace.intake_rate_limits.request_count+1
      where marketplace.intake_rate_limits.request_count<5
      returning request_count`;
    if (!limit.length) return json(res, 429, { error: "RFQ_RATE_LIMIT_EXCEEDED" });
    const id = randomUUID();
    const rows = await sql`insert into marketplace.public_rfq_intake
      (id,idempotency_key,company,contact_email,category,title,details,budget_text,region,contact_consent,privacy_notice_version,status)
      values(${id},${key},${company},${email},${category},${title},${details},${budget},${region},true,'2026-10-26','received')
      on conflict(idempotency_key) do nothing returning id`;
    const existing = rows[0]?.id || (await sql`select id from marketplace.public_rfq_intake where idempotency_key=${key} limit 1`)[0]?.id;
    if (!existing) return json(res, 500, { error: "RFQ_RECEIPT_NOT_CREATED" });
    return json(res, 201, { ok: true, status: "received", reference: existing, next: "Human review required. Supplier matching is not guaranteed." });
  } catch {
    return json(res, 503, { error: "RFQ_STORAGE_UNAVAILABLE" });
  }
}
