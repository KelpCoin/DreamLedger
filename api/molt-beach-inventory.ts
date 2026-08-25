const MARKET_NAMES:any={GLOBAL:'Global Billboard',NZ:'New Zealand Billboard',AU:'Australia Billboard',ZA:'South Africa Billboard',AMERICAS:'Americas Billboard',EUROPE:'Europe Billboard'};
const FOUNDING_UNITS=100;
function units(w:number,h:number){return Math.max(1,Math.ceil(w/100)*Math.ceil(h/100))}
export default async function handler(request:Request){
 if(request.method!=='GET')return new Response('Method not allowed',{status:405});
 const base=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!base||!key)return new Response(JSON.stringify({error:'Supabase configuration missing'}),{status:503,headers:{'content-type':'application/json'}});
 const urlObj=new URL(request.url);const market=String(urlObj.searchParams.get('market')||'GLOBAL').toUpperCase();if(!MARKET_NAMES[market])return new Response(JSON.stringify({error:'Unsupported billboard market'}),{status:400,headers:{'content-type':'application/json'}});
 const url=base.replace(/\/$/,'')+'/rest/v1/molt_beach_campaigns?market=eq.'+encodeURIComponent(market)+'&status=in.(PUBLISHED,PAID_PENDING_REVIEW)&select=campaign_id,market,x,y,width,height,price_nzd,image_url,destination_url,title,published_at,status&order=y.asc,x.asc';
 const r=await fetch(url,{headers:{apikey:key,authorization:`Bearer ${key}`}});if(!r.ok)return new Response(JSON.stringify({error:'Inventory unavailable'}),{status:503,headers:{'content-type':'application/json'}});
 const campaigns=await r.json();const sold_pixels=campaigns.reduce((n:any,c:any)=>n+Number(c.width)*Number(c.height),0);const used_units=campaigns.reduce((n:any,c:any)=>n+units(Number(c.width),Number(c.height)),0);return new Response(JSON.stringify({board:market.toLowerCase(),market,market_name:MARKET_NAMES[market],total_pixels:1000000,sold_pixels,total_founding_units:FOUNDING_UNITS,used_founding_units:used_units,remaining_founding_units:Math.max(0,FOUNDING_UNITS-used_units),campaigns}),{headers:{'content-type':'application/json','cache-control':'no-store'}});
}
