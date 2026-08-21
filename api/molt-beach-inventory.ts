export default async function handler(request:Request){
 if(request.method!=='GET')return new Response('Method not allowed',{status:405});
 const base=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!base||!key)return new Response(JSON.stringify({error:'Supabase configuration missing'}),{status:503,headers:{'content-type':'application/json'}});
 const url=base.replace(/\/$/,'')+'/rest/v1/molt_beach_campaigns?status=eq.PUBLISHED&select=campaign_id,x,y,width,height,price_nzd,image_url,destination_url,published_at&order=y.asc,x.asc';
 const r=await fetch(url,{headers:{apikey:key,authorization:`Bearer ${key}`}});if(!r.ok)return new Response(JSON.stringify({error:'Inventory unavailable'}),{status:503,headers:{'content-type':'application/json'}});
 const campaigns=await r.json();const sold_pixels=campaigns.reduce((n:any,c:any)=>n+Number(c.width)*Number(c.height),0);return new Response(JSON.stringify({board:'molt-beach',total_pixels:1000000,sold_pixels,campaigns}),{headers:{'content-type':'application/json','cache-control':'no-store'}});
}
