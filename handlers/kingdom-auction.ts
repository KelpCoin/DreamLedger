// Kingdom auction capability router: explicit consumer registry, never arbitrary silo dispatch.
// A target adapter applies the signed Gauntlet allocation, identity and payment controls.
import mtgAuction from "./mtg-auction-v2.ts";
const json=(v,s)=>new Response(JSON.stringify(v),{status:s,headers:{"content-type":"application/json","cache-control":"no-store"}});
const ADAPTERS=Object.freeze({"mtg-master":mtgAuction});
export default async function handler(req){
 const u=new URL(req.url),silo=u.searchParams.get("silo");
 if(!silo||!Object.hasOwn(ADAPTERS,silo))return json({error:"KINGDOM_AUCTION_SILO_NOT_REGISTERED"},404);
 // Each consumer keeps its own isolated schema, release gate, backend and legal context.
 return ADAPTERS[silo](req);
}
