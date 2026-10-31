// Kingdom auction capability adapter router. MTG is the CUBE gold master.
// Any unrelated B2B silo can plug in a separately verified, scoped adapter.
// This router DOES NOT grant payment authorization or share tenant state.
import mtgMaster from "./mtg-auction-v2.ts";
const json=(v,status)=>new Response(JSON.stringify(v),{status,headers:{"content-type":"application/json","cache-control":"no-store"}});
const SLUG=/^[a-z][a-z0-9_-]{1,63}$/;

export function createKingdomAuctionRouter(adapters){
 if(!adapters||typeof adapters!=="object"||Array.isArray(adapters))throw Error("KINGDOM_INVALID_ADAPTER_REGISTRY");
 const entries=Object.entries(adapters);
 if(!entries.length)throw Error("KINGDOM_EMPTY_ADAPTER_REGISTRY");
 const routes=new Map();
 for(const [silo,adapter] of entries){
  if(!SLUG.test(silo)||typeof adapter!=="function"||routes.has(silo))throw Error("KINGDOM_INVALID_ADAPTER_REGISTRY");
  routes.set(silo,adapter);
 }
 // Unknown target never falls through to MTG or any other silo.
 return async function kingdomAuctionRouter(request){
  let url;try{url=new URL(request.url)}catch{return json({error:"KINGDOM_AUCTION_INVALID_URL"},400)}
  const ids=url.searchParams.getAll("silo");
  if(ids.length!==1||!routes.has(ids[0]))return json({error:"KINGDOM_AUCTION_SILO_NOT_REGISTERED"},404);
  const result=await routes.get(ids[0])(request);
  if(!(result instanceof Response))return json({error:"KINGDOM_AUCTION_ADAPTER_INVALID_RESPONSE"},503);
  return result;
 };
}

// Reference adapter only; another target must register an explicit independent adapter.
// A CUBE blueprint alone never modifies this list or activates a consumer.
const productionAdapters=Object.freeze({"mtg-master":mtgMaster});
export default createKingdomAuctionRouter(productionAdapters);
