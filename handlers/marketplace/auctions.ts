import { neon } from "@neondatabase/serverless";

export default async function handler(req: any, res: any) {
  res.setHeader("cache-control", "no-store");
  res.setHeader("content-type", "application/json; charset=utf-8");
  if (req.method !== "GET") return res.status(405).send(JSON.stringify({error:"METHOD_NOT_ALLOWED"}));
  if (!process.env.NEON_DATABASE_URL) return res.status(503).send(JSON.stringify({error:"MARKETPLACE_NOT_CONFIGURED",auctions:[]}));
  const silo=String(req.query?.silo||"").trim().slice(0,100);
  try {
    const sql=neon(process.env.NEON_DATABASE_URL);
    const rows=await sql`SELECT id,silo_id,slug,title,description,category,price_minor,currency,
      minimum_increment_minor,closes_at,current_bid_minor,bid_count
      FROM marketplace.auction_public
      WHERE (${silo}='' OR silo_id=${silo}) AND silo_id !~* '(adult|amplissa|mplusa)'
      ORDER BY closes_at ASC LIMIT 100`;
    return res.status(200).send(JSON.stringify({schema:"dreamledger/auctions-public/v1",asOf:new Date().toISOString(),count:rows.length,auctions:rows}));
  } catch {return res.status(503).send(JSON.stringify({error:"AUCTION_READ_UNAVAILABLE",auctions:[]}))}
}
