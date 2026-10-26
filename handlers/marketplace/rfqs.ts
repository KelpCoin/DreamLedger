import { neon } from "@neondatabase/serverless";

export default async function handler(req: any, res: any) {
  res.setHeader("cache-control", "no-store");
  res.setHeader("content-type", "application/json; charset=utf-8");
  if (req.method !== "GET") return res.status(405).send(JSON.stringify({ error: "METHOD_NOT_ALLOWED" }));
  if (!process.env.NEON_DATABASE_URL) return res.status(503).send(JSON.stringify({ error: "MARKETPLACE_NOT_CONFIGURED", rfqs: [] }));
  try {
    const sql = neon(process.env.NEON_DATABASE_URL);
    const rows = await sql`select id,silo_id,title,description,budget_minor,currency,created_at
      from marketplace.rfqs where status='open' and visibility='marketplace'
      order by created_at desc limit 50`;
    return res.status(200).send(JSON.stringify({ schema: "dreamledger/marketplace-rfqs/v1", count: rows.length, rfqs: rows }));
  } catch {
    return res.status(503).send(JSON.stringify({ error: "MARKETPLACE_READ_UNAVAILABLE", rfqs: [] }));
  }
}
