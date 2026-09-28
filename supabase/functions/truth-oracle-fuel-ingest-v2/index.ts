import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const db=createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const LOC:Record<string,[number,number]>={
  Auckland:[-36.8509,174.7645],
  Tauranga:[-37.6878,176.1651],
  Hamilton:[-37.7870,175.2793],
  Wellington:[-41.2866,174.7756],
  Christchurch:[-43.5321,172.6362],
  Dunedin:[-45.8788,170.5028]
};

async function sha(value:string){
  const d=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));
  return Array.from(new Uint8Array(d)).map(x=>x.toString(16).padStart(2,"0")).join("");
}

const out=(body:unknown,status=200)=>Response.json(body,{status});

Deno.serve(async req=>{
  if(req.method!=="POST") return out({error:"POST required"},405);

  const body=await req.json();
  const name=String(body?.name||"");

  if(!(name in LOC))
    return out({error:"location_not_allowed",allowed:Object.keys(LOC)},400);

  const [lat,lng]=LOC[name];
  const radius=Math.min(Math.max(Number(body?.radius||10000),1000),25000);

  const url=new URL("https://petrolmate.com.au/api/v1/stations/area");
  url.searchParams.set("lat",String(lat));
  url.searchParams.set("lng",String(lng));
  url.searchParams.set("radius",String(radius));
  url.searchParams.set("limit","50");

  const res=await fetch(url);
  if(!res.ok) return out({error:"upstream",status:res.status},502);

  const payload:any=await res.json();
  const rows:any[]=[];

  for(const station of (payload?.stations||[])){
    for(const fuel of (station?.fuels||[])){
      if(!["ULP","PULP95","DIESEL"].includes(String(fuel?.type))) continue;

      const price=Number(fuel?.price);
      if(!Number.isFinite(price)) continue;

      const observed=fuel?.updated?new Date(fuel.updated):null;
      const age=observed&&!isNaN(observed.getTime())
        ? Math.max(0,Math.floor((Date.now()-observed.getTime())/1000))
        : null;

      const evidence={
        station_id:station.id,
        name:station.name,
        brand:station.brand,
        address:station.address,
        suburb:station.suburb,
        state:station.state,
        lat:station.lat,
        lng:station.lng,
        distance_m:station.distance_m,
        fuel_type:fuel.type,
        fuel_name:fuel.name,
        price_cents_per_litre:price,
        updated:fuel.updated||null,
        upstream:"petrolmate"
      };

      rows.push({
        domain:"fuel",
        subject:String(fuel.type),
        item:String(fuel.name||fuel.type),
        value_numeric:price,
        unit:"cents_per_litre",
        currency:"NZD",
        location_name:name,
        latitude:Number(station.lat),
        longitude:Number(station.lng),
        source_name:"PetrolMate",
        source_url:"https://petrolmate.com.au/api/v1/stations/area",
        source_observed_at:observed&&!isNaN(observed.getTime())?observed.toISOString():null,
        retrieved_at:new Date().toISOString(),
        freshness_seconds:age,
        status:age==null?"UNKNOWN":age<=86400?"OBSERVED":"STALE",
        evidence_hash:await sha(JSON.stringify(evidence)),
        raw_ref:String(station.id),
        metadata:{station,fuel,query_location:name}
      });
    }
  }

  if(rows.length){
    const {error}=await db.from("truth_oracle_public_observations")
      .upsert(rows,{onConflict:"evidence_hash",ignoreDuplicates:true});
    if(error) return out({error:error.message},500);
  }

  return out({
    service:"Truth Oracle Fuel Ingest",
    source:"PetrolMate",
    location:name,
    stations_scanned:payload?.count||0,
    observations_seen:rows.length,
    retrieved_at:new Date().toISOString()
  });
});
