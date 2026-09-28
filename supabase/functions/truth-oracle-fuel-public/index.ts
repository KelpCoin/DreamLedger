import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const db=createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_ANON_KEY")!
);

const headers={
  "Content-Type":"application/json; charset=utf-8",
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"content-type",
  "Access-Control-Allow-Methods":"GET,OPTIONS",
  "Cache-Control":"public, max-age=60"
};

const out=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});

Deno.serve(async req=>{
  if(req.method==="OPTIONS") return new Response(null,{status:204,headers});
  if(req.method!=="GET") return out({error:"GET required"},405);

  const u=new URL(req.url);
  const subject=(u.searchParams.get("subject")||"").trim();
  const location=(u.searchParams.get("location")||"").trim();
  const limit=Math.min(Math.max(Number(u.searchParams.get("limit")||"25"),1),100);

  let q=db.from("truth_oracle_public_latest_fuel").select("*").limit(limit);
  if(subject) q=q.eq("subject",subject);
  if(location) q=q.eq("location_name",location);

  const {data,error}=await q;
  if(error) return out({error:error.message},500);

  return out({
    service:"Truth Oracle Public",
    domain:"fuel",
    status:"READ_ONLY",
    generated_at:new Date().toISOString(),
    subject:subject||null,
    location:location||null,
    observations:data||[],
    contract:"SOURCE -> OBSERVATION -> FRESHNESS -> VERDICT"
  });
});
