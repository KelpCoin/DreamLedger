// Authenticated closing worker. Configure private scheduled invocation only after approval.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "https://esm.sh/@supabase/supabase-js@2.57.2";
const reply=(v:unknown,s=200)=>new Response(JSON.stringify(v),{status:s,headers:{"content-type":"application/json","cache-control":"no-store"}});
Deno.serve(async(req)=>{
 if(req.method!=="POST")return reply({error:"METHOD_NOT_ALLOWED"},405);
 if(Deno.env.get("MTG_AUCTION_CLOSE_ENABLED")!=="true")return reply({error:"CLOSE_WORKER_HOLD"},503);
 const secret=Deno.env.get("MTG_AUCTION_CRON_SECRET");
 if(!secret||req.headers.get("authorization")!=="Bearer "+secret)return reply({error:"UNAUTHORIZED"},401);
 const base=Deno.env.get("SUPABASE_URL"),service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!base||!service)return reply({error:"CONFIG_MISSING"},503);
 const db=createClient(base,service,{auth:{autoRefreshToken:false,persistSession:false}});
 const {data:due,error}=await db.from("mtg_auction_lots_v2").select("id").eq("status","open").lte("ends_at",new Date().toISOString()).order("ends_at",{ascending:true}).limit(50);
 if(error)return reply({error:"READ_FAILED"},503);
 let processed=0;const failed:string[]=[];
 for(const lot of due||[]){
  const {error:e}=await db.rpc("mtg_auction_close_v2",{p_auction:lot.id});
  if(e)failed.push(lot.id);else processed++;
 }
 if(failed.length)return reply({error:"CLOSE_RETRY_NEEDED",processed,failed},503);
 return reply({ok:true,processed,checked:(due||[]).length});
});
