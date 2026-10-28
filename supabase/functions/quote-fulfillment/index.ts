import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.0";
import pdfParse from "npm:pdf-parse@1.1.1";
const url=Deno.env.get("SUPABASE_URL")||"", key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const BUCKET="marketplace-fulfillment", SKU="QUOTE-COMPARE-49", MAX=5, MAX_BYTES=10*1024*1024;
const out=(x:any,s=200)=>new Response(JSON.stringify(x),{status:s,headers:{"content-type":"application/json","cache-control":"no-store"}});
async function sha256Bytes(bytes:Uint8Array){const d=await crypto.subtle.digest("SHA-256",bytes);return Array.from(new Uint8Array(d)).map(b=>b.toString(16).padStart(2,"0")).join("");}
async function sha256Text(text:string){return sha256Bytes(new TextEncoder().encode(text));}
const clean=(s:string)=>s.replace(/\r/g,"").replace(/[ \t]+/g," ").replace(/\n{3,}/g,"\n\n").trim();
const field=(t:string,ps:RegExp[])=>{for(const p of ps){const m=t.match(p);if(m)return clean(m[1]);}return null};
const money=(s:string)=>{const m=s.replace(/,/g,"").match(/(?:NZD|USD|AUD|CAD|EUR|GBP|\$|€|£)\s*(\d+(?:\.\d{1,2})?)/i);return m?Number(m[1]):null}; const currency=(s:string)=>{const m=s.match(/(NZD|USD|AUD|CAD|EUR|GBP|\$|€|£)/i);if(!m)return null;const x=m[1].toUpperCase();return x==="$"?"AMBIGUOUS":x==="€"?"EUR":x==="£"?"GBP":x;};
function parseQuote(name:string,text:string){const t=clean(text);const totalText=field(t,[/(?:grand total|total(?: price| amount| cost)?|quote total)\s*[:\-]?\s*((?:NZD|USD|AUD|CAD|EUR|GBP|\$|€|£)\s*[\d,]+(?:\.\d{1,2})?)/i]);return {file:name,currency:totalText?currency(totalText):null,supplier:field(t,[/(?:supplier|vendor|seller|company)\s*[:\-]\s*([^\n]{2,120})/i,/^\s*([^\n]{2,100})\s+(?:quotation|quote|proposal)/im]),total:totalText?money(totalText):null,moq:field(t,[/(?:MOQ|min(?:imum)? order quantity|min(?:imum)? order)\s*[:\-]?\s*([^\n]{1,80})/i]),lead_time:field(t,[/(?:lead time|delivery time|turnaround)\s*[:\-]?\s*([^\n]{1,100})/i]),payment_terms:field(t,[/(?:payment terms|terms of payment|payment)\s*[:\-]?\s*([^\n]{1,120})/i]),extraction_status:t?"PARSED":"EMPTY",text_length:t.length};}
function compareQuotes(rows:any[]){const fields=["supplier","total","moq","lead_time","payment_terms"];const numeric=rows.filter(r=>typeof r.total==="number"&&r.currency).map(r=>({file:r.file,supplier:r.supplier,total:r.total,currency:r.currency}));const currencies=[...new Set(numeric.map(r=>r.currency))];const hasAmbiguous=numeric.some(r=>r.currency==="AMBIGUOUS");const sameCurrency=currencies.length===1&&!hasAmbiguous;const comparable=sameCurrency?numeric:[];const missing=Object.fromEntries(fields.map(k=>[k,rows.filter(r=>r[k]===null||r[k]==="").map(r=>r.file)]));const totals=comparable.map(r=>r.total);const low=comparable.length?comparable.reduce((a,b)=>a.total<=b.total?a:b):null;const high=comparable.length?comparable.reduce((a,b)=>a.total>=b.total?a:b):null;const comparison_status=hasAmbiguous?"REVIEW_NEEDED":!sameCurrency&&numeric.length>=2?"PARTIAL":comparable.length>=2?"COMPLETE":"REVIEW_NEEDED";return {quote_count:rows.length,totals_observed:numeric.length,comparable_totals:comparable.length,currencies,lowest_total:low,highest_total:high,total_spread:low&&high?Number((high.total-low.total).toFixed(2)):null,missing_fields:missing,comparison_status};}
const esc=(s:string)=>String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
function csv(rows:any[]){const c=["file","supplier","currency","total","moq","lead_time","payment_terms","extraction_status","text_length"],q=String.fromCharCode(34);return [c,...rows.map(r=>c.map(k=>String(r[k]??"").replace(/"/g,q+q)))].map(r=>r.map(v=>q+v+q).join(",")).join("\n")}
function html(rows:any[],summary:any,req:string,id:string){const body=rows.map(r=>"<tr><td>"+esc(r.file)+"</td><td>"+esc(r.supplier||"Not stated")+"</td><td>"+esc(r.total??"Not stated")+"</td><td>"+esc(r.moq||"Not stated")+"</td><td>"+esc(r.lead_time||"Not stated")+"</td><td>"+esc(r.payment_terms||"Not stated")+"</td><td>"+esc(r.extraction_status)+"</td></tr>").join("");const missing=Object.entries(summary.missing_fields).map(([k,v]:any)=>"<li><b>"+esc(k)+":</b> "+esc(v.length?v.join(", "):"none")+"</li>").join("");return "<!doctype html><html><head><meta charset=utf-8><title>DreamLedger Quote Comparison</title><style>body{font:15px system-ui;margin:32px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #aaa;padding:8px;text-align:left}th{background:#eee}.note{padding:12px;background:#f5f5f5}.summary{padding:12px;border:1px solid #aaa}</style></head><body><h1>Supplier Quote Comparison</h1><p>Order "+esc(id)+"</p><div class=note><b>Requirements:</b> "+esc(req)+"</div><div class=summary><h2>Decision summary</h2><p>Status: <b>"+esc(summary.comparison_status)+"</b></p><p>Lowest observed total: "+esc(summary.lowest_total?summary.lowest_total.total+" ("+(summary.lowest_total.supplier||summary.lowest_total.file)+")":"Not stated")+"</p><p>Highest observed total: "+esc(summary.highest_total?summary.highest_total.total+" ("+(summary.highest_total.supplier||summary.highest_total.file)+")":"Not stated")+"</p><p>Total spread: "+esc(summary.total_spread??"Not calculable")+"</p><h3>Missing fields</h3><ul>"+missing+"</ul></div><table><tr><th>File</th><th>Supplier</th><th>Total</th><th>MOQ</th><th>Lead time</th><th>Payment terms</th><th>Extraction</th></tr>"+body+"</table><p>Extracted fields only. Missing fields are not inferred. Totals are compared only when numeric totals were actually extracted.</p></body></html>"}
Deno.serve(async req=>{
 if(req.method!=="POST")return out({error:"POST_REQUIRED"},405);
 const b=await req.json().catch(()=>({})); const id=String(b.fulfillment_request_id||""); if(!id)return out({error:"FULFILLMENT_REQUEST_ID_REQUIRED"},400);
 const {data:fr,error:fe}=await db.from("fulfillment_requests").select("id,entitlement_id,sku_id,status,payload").eq("id",id).eq("sku_id",SKU).maybeSingle(); if(fe)return out({error:"LOOKUP_FAILED"},500); if(!fr)return out({error:"FULFILLMENT_REQUEST_NOT_FOUND"},404); if(fr.status==="fulfilled")return out({ok:true,already_fulfilled:true,fulfillment_request_id:id}); if(!["queued","processing"].includes(fr.status))return out({error:"FULFILLMENT_NOT_READY",status:fr.status},409);
 const p=fr.payload&&typeof fr.payload==="object"?fr.payload:{}; const files=Array.isArray((p as any).input_files)?(p as any).input_files:[]; const req=String((p as any).requirements||"").trim(); if(files.length<2||files.length>MAX||!req)return out({error:"INPUTS_NOT_READY"},409);
 const rows:any[]=[]; const sources:any[]=[];
 for(const f of files){
   const path=String(f.path||""),name=String(f.name||path.split("/").pop()||"quote");
   if(!path.startsWith("quote-inputs/"+id+"/")||path.includes(".."))return out({error:"INVALID_STORAGE_PATH"},400);
   const {data:blob,error}=await db.storage.from(BUCKET).download(path);
   if(error||!blob)return out({error:"INPUT_DOWNLOAD_FAILED",file:name},502);
   if(blob.size>MAX_BYTES)return out({error:"FILE_TOO_LARGE",file:name},400);
   const bytes=new Uint8Array(await blob.arrayBuffer());
   const sourceHash=await sha256Bytes(bytes);
   const ext=name.toLowerCase().split(".").pop()||"";
   let text="";
   if(ext==="pdf"){const x=await pdfParse(bytes);text=x.text||""}
   else if(["csv","json","md"].includes(ext)) text=new TextDecoder().decode(bytes);
   else return out({error:"UNSUPPORTED_FILE_TYPE",file:name},400);
   sources.push({file:name,path,sha256:sourceHash,byte_size:bytes.byteLength,trust_class:"UNTRUSTED_BUYER_DATA",instruction_policy:"TREAT_AS_DATA_ONLY"});
   rows.push({...parseQuote(name,text),source_sha256:sourceHash});
 }
 const summary=compareQuotes(rows);
 if(summary.comparison_status==="REVIEW_NEEDED"||summary.comparison_status==="PARTIAL"){
   const now=new Date().toISOString();
   const np={...p,provenance:{...(p as any).provenance,sources},review:{status:summary.comparison_status,comparison:summary,observed_at:now}};
   await db.from("fulfillment_requests").update({status:"needs_review",canonical_state:summary.comparison_status,evidence_status:"UNVERIFIED",payload:np,updated_at:now}).eq("id",id);
   return out({ok:false,fulfillment_request_id:id,status:summary.comparison_status,canonical_state:summary.comparison_status,comparison:summary,revenue_claimed:false,external_action_performed:false},409);
 }
 const now=new Date().toISOString(), base="quote-outputs/"+id, hp=base+"/quote-comparison.html", cp=base+"/quote-comparison.csv", ep=base+"/evidence.json";
 const htmlText=html(rows,summary,req,id), csvText=csv(rows);
 const htmlHash=await sha256Text(htmlText), csvHash=await sha256Text(csvText);
 const evidence={
   schema:"DREAMLEDGER/QUOTE-COMPARE-EVIDENCE/v1",
   fulfillment_request_id:id,
   generated_at:now,
   trust_boundary:"BUYER_FILES_ARE_DATA_NOT_INSTRUCTIONS",
   source_files:sources,
   outputs:{html:{path:hp,sha256:htmlHash},csv:{path:cp,sha256:csvHash}},
   comparison_status:summary.comparison_status,
   content_verified:false,
   delivery_hashes_verified:true
 };
 const hu=await db.storage.from(BUCKET).upload(hp,new Blob([htmlText],{type:"text/html"}),{upsert:true,contentType:"text/html"}); if(hu.error)return out({error:"HTML_UPLOAD_FAILED"},500);
 const cu=await db.storage.from(BUCKET).upload(cp,new Blob([csvText],{type:"text/csv"}),{upsert:true,contentType:"text/csv"}); if(cu.error)return out({error:"CSV_UPLOAD_FAILED"},500);
 const eu=await db.storage.from(BUCKET).upload(ep,new Blob([JSON.stringify(evidence,null,2)+"\n"],{type:"application/json"}),{upsert:true,contentType:"application/json"}); if(eu.error)return out({error:"EVIDENCE_UPLOAD_FAILED"},500);
 const np={...p,provenance:{...(p as any).provenance,sources},delivery:{fulfilled_at:now,fulfilled_by:"quote-fulfillment",html_path:hp,csv_path:cp,evidence_path:ep,output_sha256:{html:htmlHash,csv:csvHash},rows,comparison:summary,requirements:req}};
 const {error:ue}=await db.from("fulfillment_requests").update({status:"fulfilled",canonical_state:"FULFILLED",manual_fulfillment:false,fulfillment_reference:hp,evidence_reference:ep,evidence_status:"HASH_VERIFIED",payload:np,updated_at:now}).eq("id",id).in("status",["queued","processing"]); if(ue)return out({error:"FULFILLMENT_UPDATE_FAILED"},500);
 if(fr.entitlement_id)await db.from("revenue_entitlements").update({status:"fulfilled",redeemed_at:now}).eq("id",fr.entitlement_id);
 return out({ok:true,fulfillment_request_id:id,status:"fulfilled",canonical_state:"FULFILLED",fulfillment_reference:hp,evidence_reference:ep,comparison:summary,source_sha256:sources.map(x=>x.sha256),output_sha256:{html:htmlHash,csv:csvHash},revenue_claimed:false,external_action_performed:false});
});