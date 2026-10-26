import { neon } from "@neondatabase/serverless";
import { createHash, timingSafeEqual } from "node:crypto";

const json = (res: any, status: number, body: unknown) => {
  res.status(status).setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.send(JSON.stringify(body));
};
function tokenMatches(candidate: string, expected: string) {
  const a = createHash("sha256").update(candidate).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}
export default async function handler(req: any, res: any) {
  if (req.method !== "GET") return json(res, 405, { error: "METHOD_NOT_ALLOWED" });
  const expected = process.env.B2B_ADMIN_TOKEN || "";
  const supplied = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!expected) return json(res, 503, { error: "B2B_ADMIN_NOT_CONFIGURED" });
  if (!supplied || !tokenMatches(supplied, expected)) return json(res, 401, { error: "ADMIN_AUTH_REQUIRED" });
  if (!process.env.NEON_DATABASE_URL) return json(res, 503, { error: "MARKETPLACE_NOT_CONFIGURED" });
  try {
    const sql = neon(process.env.NEON_DATABASE_URL);
    const rows = await sql`select id,company,contact_email,category,title,details,budget_text,region,status,created_at
      from marketplace.public_rfq_intake order by created_at desc limit 100`;
    const sellers = await sql`select id,listing_kind,title,description,price_minor,quantity,business_name,gst_status,contact_email,notes,status,created_at
      from marketplace.public_seller_intake order by created_at desc limit 100`;
    return json(res, 200, { schema: "dreamledger/private-rfq-inbox/v1", count: rows.length, requests: rows, seller_count: sellers.length, seller_applications: sellers });
  } catch {
    return json(res, 503, { error: "RFQ_INBOX_UNAVAILABLE" });
  }
}
