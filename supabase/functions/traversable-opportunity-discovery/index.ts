import "jsr:@supabase/functions-js/edge-runtime.d.ts";

type Gate = "PASS" | "BLOCKED" | "UNKNOWN" | "EXPIRED" | "NOT_APPLICABLE";
type Observation = {
  opportunity_key: string; source: string; source_reference: string; observed_at: string;
  subject: string; commercial_terms: Record<string, unknown>; required_capability: string[];
  access_surface: string; provenance: Record<string, unknown>; traversability: Record<string, Gate>;
  state: "TRAVERSABILITY_PENDING" | "TRAVERSABLE" | "STRUCTURALLY_UNAVAILABLE";
};
const json=(x:unknown,status=200)=>new Response(JSON.stringify(x),{status,headers:{"content-type":"application/json; charset=utf-8"}});
function gateState(g:Record<string,Gate>) {
  const essential=["representation_chain","settlement","access_surface","demand_reachability","data_availability","jurisdiction"];
  if(essential.some(k=>g[k]==="BLOCKED")) return "STRUCTURALLY_UNAVAILABLE" as const;
  if(essential.every(k=>g[k]==="PASS"||g[k]==="NOT_APPLICABLE")) return "TRAVERSABLE" as const;
  return "TRAVERSABILITY_PENDING" as const;
}
function githubObservation(item:any):Observation {
  const url=String(item.html_url||""); const repo=String(item.repository_url||"").split("/repos/")[1]||"";
  const title=String(item.title||"GitHub issue"); const body=String(item.body||"").slice(0,4000);
  const labels=Array.isArray(item.labels)?item.labels.map((x:any)=>String(x.name||"")):[]; const text=(title+" "+body+" "+labels.join(" ")).toLowerCase();
  const caps:string[]=[]; if(/api|integration|sdk/.test(text))caps.push("API_INTEGRATION"); if(/scrap|crawl|extract|data/.test(text))caps.push("DATA_EXTRACTION");
  if(/automation|workflow|ci|github actions/.test(text))caps.push("AUTOMATION"); if(/bug|fix|regression|error/.test(text))caps.push("SOFTWARE_DEBUG"); if(!caps.length)caps.push("SOFTWARE_RESEARCH");
  const gates:Record<string,Gate>={representation_chain:"UNKNOWN",settlement:"UNKNOWN",reversibility:"UNKNOWN",access_surface:"PASS",platform_dependency:"PASS",reputation_scope:"UNKNOWN",demand_reachability:"PASS",liquidity:"UNKNOWN",contribution_margin_after_external_tolls:"UNKNOWN",throughput:"UNKNOWN",dependency_health:"PASS",temporal_consistency:"PASS",jurisdiction:"UNKNOWN",data_availability:"PASS",incentive_alignment:"UNKNOWN",exit_cost:"UNKNOWN",obligation_load:"UNKNOWN"};
  return {opportunity_key:"GITHUB-ISSUE-"+String(item.id),source:"github_public_issues",source_reference:url,observed_at:String(item.updated_at||item.created_at||new Date().toISOString()),subject:title,commercial_terms:{},required_capability:caps,access_surface:"public_github_issue",provenance:{repository:repo,issue_id:item.id,labels,state:item.state,source_api:"https://api.github.com/search/issues"},traversability:gates,state:gateState(gates)};
}
function parseGets(html:string):Observation[] {
  const out:Observation[]=[]; const rowRe=/<tr[^>]*>([\s\S]*?)<\/tr>/gi; let m:RegExpExecArray|null;
  while((m=rowRe.exec(html))&&out.length<100){
    const cells=[...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(x=>x[1].replace(/<[^>]+>/g," ").replace(/&nbsp;/g," ").replace(/&amp;/g,"&").replace(/\s+/g," ").trim());
    if(cells.length<5||!/^\d{6,}$/.test(cells[0]))continue;
    const links=[...m[1].matchAll(/href=["']([^"']+)["']/gi)].map(x=>x[1]); const rfx=cells[0]; const title=cells[2]||cells[1]||"GETS tender";
    const ref=links.find(x=>/ExternalTenderDetails/i.test(x))||links[0]||""; const url=ref.startsWith("http")?ref:"https://www.gets.govt.nz/"+ref.replace(/^\//,"");
    const gates:Record<string,Gate>={representation_chain:"UNKNOWN",settlement:"UNKNOWN",reversibility:"UNKNOWN",access_surface:"UNKNOWN",platform_dependency:"PASS",reputation_scope:"UNKNOWN",demand_reachability:"PASS",liquidity:"UNKNOWN",contribution_margin_after_external_tolls:"UNKNOWN",throughput:"UNKNOWN",dependency_health:"PASS",temporal_consistency:"PASS",jurisdiction:"PASS",data_availability:"PASS",incentive_alignment:"UNKNOWN",exit_cost:"UNKNOWN",obligation_load:"UNKNOWN"};
    out.push({opportunity_key:"GETS-"+rfx,source:"nz_gets",source_reference:url,observed_at:new Date().toISOString(),subject:title,commercial_terms:{tender_type:cells[3],close_date:cells[4]},required_capability:[/digital|software|data|technology|system|api|platform|online/i.test(title)?"SOFTWARE_RESEARCH":"DOMAIN_RESEARCH"],access_surface:"gets_public_index",provenance:{rfx_id:rfx,reference:cells[1],organisation:cells[5]||null,source_page:"https://www.gets.govt.nz/ExternalIndex.htm"},traversability:gates,state:gateState(gates)});
  } return out;
}
async function scanGithub(limit:number){
  const queries=['is:open label:"help wanted" automation','is:open label:"help wanted" api integration','is:open label:"good first issue" scraper','is:open label:"help wanted" bug fix'];
  const all:any[]=[]; for(const q of queries){const r=await fetch("https://api.github.com/search/issues?q="+encodeURIComponent(q)+"&sort=updated&order=desc&per_page="+Math.min(30,limit),{headers:{accept:"application/vnd.github+json","x-github-api-version":"2026-03-10","user-agent":"DreamLedger-Traversable-Swarm/1.0"}}); if(!r.ok)throw new Error("GitHub HTTP "+r.status); const j=await r.json(); all.push(...(Array.isArray(j?.items)?j.items:[]));}
  const seen=new Set<number>(); return all.filter(x=>{if(!x?.id||seen.has(x.id))return false;seen.add(x.id);return true;}).slice(0,limit).map(githubObservation);
}
async function scanGets(limit:number){
  const urls=["https://www.gets.govt.nz/ExternalIndex.htm","https://www.gets.govt.nz/ExternalIndex.htm?orderBy=type"]; let html=""; let source="";
  for(const u of urls){const r=await fetch(u,{headers:{accept:"text/html","user-agent":"DreamLedger-Traversable-Swarm/1.0"}}); if(r.ok){html=await r.text();source=u;break;}}
  if(!html)throw new Error("GETS unavailable"); return parseGets(html).slice(0,limit).map(x=>({...x,provenance:{...x.provenance,fetched_from:source}}));
}
Deno.serve(async req=>{
  if(req.method!=="GET")return json({error:"GET_REQUIRED",mutation:false},405);
  try{const u=new URL(req.url);const limit=Math.max(1,Math.min(100,Number(u.searchParams.get("limit")||"25")));const [github,gets]=await Promise.all([scanGithub(limit),scanGets(limit)]);const observations=[...github,...gets];
    return json({ok:true,schema:"dreamledger/traversable-opportunity-discovery/v1",scanned_at:new Date().toISOString(),observations,counts:{total:observations.length,github:github.length,nz_gets:gets.length,traversable:observations.filter(x=>x.state==="TRAVERSABLE").length,pending:observations.filter(x=>x.state==="TRAVERSABILITY_PENDING").length,structurally_unavailable:observations.filter(x=>x.state==="STRUCTURALLY_UNAVAILABLE").length},mutation:false,external_action_performed:false,revenue_claimed:false});
  }catch(e){return json({ok:false,error:String(e),mutation:false,external_action_performed:false,revenue_claimed:false},502);}
});