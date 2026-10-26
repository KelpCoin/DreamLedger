import { neon } from "@neondatabase/serverless";
import { createHash, randomUUID } from "node:crypto";

const kinds = new Set(["digital","physical","service","b2b","mtg"]);
const clean = (value: unknown, max: number) => String(value ?? "").trim().slice(0, max);
const send = (res: any, status: number, body: unknown) => {
  res.status(status).setHeader("content-type","application/json; charset=utf-8");
  res.setHeader("cache-control","no-store");
  res.send(JSON.stringify(body));
};
function sameOrigin(req: any) {
  const origin=req.headers.origin;
  if(!origin)return true;
  try { const u=new URL(origin); return u.host===String(req.headers.host||"") && ["https:","http:"].includes(u.protocol); }
  catch { return false; }
}
export default async function handler(req: any,res: any) {
  if(req.method!=="POST")return send(res,405,{error:"METHOD_NOT_ALLOWED"});
  if(!sameOrigin(req))return send(res,403,{error:"ORIGIN_NOT_ALLOWED"});
  if(!process.env.NEON_DATABASE_URL)return send(res,503,{error:"MARKETPLACE_NOT_CONFIGURED"});
  let b:any=req.body;
  if(typeof b==="string"){try{b=JSON.parse(b)}catch{return send(res,400,{error:"INVALID_JSON"})}}
  if(!b||typeof b!=="object"||Array.isArray(b))return send(res,400,{error:"INVALID_JSON"});
  if(clean(b.website,200))return send(res,202,{ok:true,reference:"received"});
  const kind=clean(b.kind,20),title=clean(b.title,120),description=clean(b.description,2000);
  const price=Number(b.price_nzd),quantity=Number(b.inventory);
  const business=clean(b.business,160),gst=clean(b.gst||"unknown",20),email=clean(b.email,254).toLowerCase();
  const notes=clean(b.notes,2000),key=clean(b.idempotency_key,80);
  if(!kinds.has(kind)||title.length<3||description.length<10||!Number.isFinite(price)||price<=0||
    !Number.isSafeInteger(Math.round(price*100))||!Number.isInteger(quantity)||quantity<1||quantity>1000000||
    !["yes","no","unknown"].includes(gst)||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!key||b.contact_consent!==true) {
    return send(res,422,{error:"CHECK_REQUIRED_FIELDS_AND_CONTACT_CONSENT"});
  }
  try {
    const sql=neon(process.env.NEON_DATABASE_URL);
    const ip=String(req.headers["x-real-ip"]||req.socket?.remoteAddress||"unknown").trim();
    const salt=process.env.RATE_LIMIT_SALT||"dreamledger-rfq-v1";
    const ipHash=createHash("sha256").update(ip+"|"+salt).digest("hex");
    const windowStart=new Date(Math.floor(Date.now()/3600000)*3600000).toISOString();
    const limit=await sql`insert into marketplace.intake_rate_limits(ip_hash,window_start,request_count)
      values(${ipHash},${windowStart},1)
      on conflict(ip_hash,window_start) do update
      set request_count=marketplace.intake_rate_limits.request_count+1
      where marketplace.intake_rate_limits.request_count<5
      returning request_count`;
    if(!limit.length)return send(res,429,{error:"SELLER_INTAKE_RATE_LIMIT_EXCEEDED"});
    const id=randomUUID(),minor=Math.round(price*100);
    const rows=await sql`insert into marketplace.public_seller_intake
      (id,idempotency_key,listing_kind,title,description,price_minor,quantity,business_name,gst_status,contact_email,notes,contact_consent,privacy_notice_version,status)
      values(${id},${key},${kind},${title},${description},${minor},${quantity},${business},${gst},${email},${notes},true,'2026-10-26','received')
      on conflict(idempotency_key) do nothing returning id`;
    const existing=rows[0]?.id||(await sql`select id from marketplace.public_seller_intake where idempotency_key=${key} limit 1`)[0]?.id;
    if(!existing)return send(res,500,{error:"SELLER_RECEIPT_NOT_CREATED"});
    return send(res,201,{ok:true,status:"received",reference:existing,next:"Human review required. This is an application, not a published listing or checkout."});
  } catch {
    return send(res,503,{error:"SELLER_INTAKE_STORAGE_UNAVAILABLE"});
  }
}
