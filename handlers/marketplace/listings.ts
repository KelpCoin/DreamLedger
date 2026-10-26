import { neon } from "@neondatabase/serverless";

export default async function handler(req: any, res: any) {
  res.setHeader("cache-control", "no-store");
  res.setHeader("content-type", "application/json; charset=utf-8");
  if (req.method !== "GET") return res.status(405).send(JSON.stringify({ error: "METHOD_NOT_ALLOWED" }));
  if (!process.env.NEON_DATABASE_URL) return res.status(503).send(JSON.stringify({ error: "MARKETPLACE_NOT_CONFIGURED", listings: [] }));
  try {
    const sql = neon(process.env.NEON_DATABASE_URL);
    const silo = String(req.query?.silo || "").trim().slice(0, 100);
    const rows = await sql`select l.id,l.silo_id,o.display_name as seller,l.slug,l.title,l.description,l.category,l.listing_type,l.price_minor,l.currency,l.quantity,l.media,l.published_at
      from marketplace.listings l join marketplace.organizations o on o.id=l.organization_id
      where l.status='published' and l.quantity>0 and (${silo}='' or l.silo_id=${silo})
      order by l.published_at desc limit 50`;
    return res.status(200).send(JSON.stringify({ schema: "dreamledger/marketplace-listings/v1", count: rows.length, listings: rows }));
  } catch {
    return res.status(503).send(JSON.stringify({ error: "MARKETPLACE_READ_UNAVAILABLE", listings: [] }));
  }
}
