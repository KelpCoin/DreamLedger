import { neon } from "@neondatabase/serverless";

export default async function handler(req: any, res: any) {
  res.setHeader("cache-control", "no-store");
  res.setHeader("content-type", "application/json; charset=utf-8");
  if (req.method !== "GET") return res.status(405).send(JSON.stringify({error:"METHOD_NOT_ALLOWED"}));
  if (!process.env.NEON_DATABASE_URL) return res.status(503).send(JSON.stringify({error:"MARKETPLACE_NOT_CONFIGURED",markets:[]}));
  try {
    const sql=neon(process.env.NEON_DATABASE_URL);
    const rows=await sql`SELECT market_code,capacity,published_units,remaining_units
      FROM marketplace.billboard_public_inventory ORDER BY market_code`;
    return res.status(200).send(JSON.stringify({schema:"dreamledger/billboard-inventory/v1",asOf:new Date().toISOString(),markets:rows,
      paymentsVerifiedByThisEndpoint:false}));
  } catch {return res.status(503).send(JSON.stringify({error:"BILLBOARD_INVENTORY_READ_UNAVAILABLE",markets:[]}))}
}
