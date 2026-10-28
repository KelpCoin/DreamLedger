"use strict";
// Thin Vercel adapter over existing public catalog and CUBE silo registry.
// This is read-only discovery, not Stripe settlement, stock validation or an order writer.
const fs=require("node:fs"),path=require("node:path");
const ROOT=path.resolve(__dirname,"..");
// Static requires ensure Vercel function tracing bundles these existing evidence sources.
const CATALOG_SOURCE=require("../public/catalog.json");
const SILO_SOURCE=require("../BEC-PRIME/catalog/silos/CUBE-SILO-REGISTRY.json");
function json(res,status,payload){res.statusCode=status;res.setHeader("content-type","application/json; charset=utf-8");res.setHeader("cache-control","public, max-age=60");res.end(JSON.stringify(payload));}
function read(file){return JSON.parse(fs.readFileSync(path.join(ROOT,file),"utf8"));}
function hostedStripe(value){try{const u=new URL(String(value||""));return u.protocol==="https:"&&["buy.stripe.com","checkout.stripe.com"].includes(u.hostname)?u.href:null;}catch{return null;}}
function getCatalog(){
 const catalog=CATALOG_SOURCE;
 const source=Array.isArray(catalog.products)?catalog.products:[];
 const products=source.filter(p=>p&&p.id&&p.name&&p.status==="published").map(p=>{
 const link=hostedStripe(p.checkout_url);
 const checkout=Boolean(p.checkout_available===true&&link&&Number.isFinite(Number(p.price))&&Number(p.price)>0);
 return {id:String(p.id).slice(0,100),name:String(p.name).slice(0,160),description:String(p.description||"").slice(0,600),category:String(p.category||"uncategorised").slice(0,100),price:Number(p.price),currency:String(p.currency||"nzd").toUpperCase(),status:"LISTED",checkout_available:checkout,checkout_url:checkout?link:null,delivery_status:"unknown",source:"public_catalog"};
 });
 return {schema:"beck/discovery-catalog/v1",source:"existing_public_catalog",count:products.length,products,verified_external_revenue_claim:false};
}
function getSilos(){
 const registry=SILO_SOURCE;
 const silos=(Array.isArray(registry.silos)?registry.silos:[]).filter(s=>s&&s.id&&s.label).map(s=>{
 const route=String(s.route||"");
 const rel=route.replace(/^\//,"");
 const exists=route.startsWith("/")&&(fs.existsSync(path.join(ROOT,"public",rel))||fs.existsSync(path.join(ROOT,"public",rel,"index.html")));
 return {id:String(s.id).slice(0,80),label:String(s.label).slice(0,100),route:exists?route:"/marketplace.html?q="+encodeURIComponent(String(s.id)),status:"REGISTERED",market:s.market||null,inventory_verified:false};
 });
 return {schema:"beck/discovery-silos/v1",count:silos.length,silos};
}
module.exports=async function handler(req,res){
 const pathname=new URL(String(req.url||"/"),"https://dreamledger.org").pathname;
 if(req.method!=="GET"&&req.method!=="HEAD")return json(res,405,{error:"method_not_allowed"});
 try{
  if(pathname==="/api/discovery/catalog")return json(res,200,getCatalog());
  if(pathname==="/api/discovery/silos")return json(res,200,getSilos());
  return json(res,404,{error:"not_found"});
 }catch(_){return json(res,503,{error:"discovery_source_unavailable"});}
};
