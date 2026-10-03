import json, os, sys, time, subprocess, urllib.request, urllib.parse
from datetime import datetime, timezone

ROOT=os.environ.get("DREAMLEDGER_ROOT") or os.getcwd()
RUNS=os.path.join(ROOT,"runtime","lm_studio","runs"); os.makedirs(RUNS,exist_ok=True)
ROUNDS=max(2,int(os.environ.get("DREAMLEDGER_REFINEMENT_ROUNDS","5")))
INTERVAL=int(os.environ.get("DREAMLEDGER_SWARM_INTERVAL_SECONDS","60"))
LM_BASE=os.environ.get("LM_STUDIO_BASE_URL","http://127.0.0.1:12340").rstrip("/")
OL_BASE=os.environ.get("DREAMLEDGER_OLLAMA_BASE_URL","http://127.0.0.1:11434").rstrip("/")

ROLES=["SCOUT","ANALYST","BUILDER","CRITIC","GAUNTLET","SYNTHESIS"]
ENV={"SCOUT":"DREAMLEDGER_SCOUT_MODEL","ANALYST":"DREAMLEDGER_ANALYST_MODEL","BUILDER":"DREAMLEDGER_BUILDER_MODEL","CRITIC":"DREAMLEDGER_LM_MODEL_CRITIC","GAUNTLET":"DREAMLEDGER_GAUNTLET_MODEL","SYNTHESIS":"DREAMLEDGER_SYNTHESIS_MODEL"}
PREFERRED_PROVIDER={"SCOUT":"LM_STUDIO","ANALYST":"OLLAMA","BUILDER":"LM_STUDIO","CRITIC":"LM_STUDIO","GAUNTLET":"OLLAMA","SYNTHESIS":"LM_STUDIO"}
DEFAULT_TERMS={"SCOUT":["creative","qwen2.5-7b"],"ANALYST":["gpt-oss","deepseek","qwen","llama","mistral"],"BUILDER":["coder","qwen2.5-coder"],"CRITIC":["local","phi"],"GAUNTLET":["gpt-oss","deepseek","llama","qwen","mistral"],"SYNTHESIS":["creative","qwen2.5-7b","llama","mistral"]}
SYSTEM={
"SCOUT":"discover and refresh opportunities from supplied evidence; never invent facts",
"ANALYST":"qualify economics, evidence, freshness, traversability and assumptions",
"BUILDER":"construct the smallest useful internal artifact or preparation; never act externally",
"CRITIC":"falsify the packet; hunt contradictions, stale evidence and hidden blockers",
"GAUNTLET":"adversarially reject unsupported, unauthorized, irreversible or prohibited actions",
"SYNTHESIS":"reconcile the panel into the strongest evidence-backed next state while preserving blockers"
}
CONSTRAINTS=["no fake buyers","no simulated revenue","no self purchase","no autonomous outreach","no autonomous spending","no secret handling","no platform bypass","human gate for irreversible external action","UNKNOWN remains UNKNOWN","consensus is not truth","confidence is not evidence"]

def api(base,path,body=None,timeout=180):
 d=None if body is None else json.dumps(body,separators=(",",":")).encode()
 h={"Accept":"application/json"}
 if body is not None:h["Content-Type"]="application/json"
 r=urllib.request.Request(base+path,data=d,headers=h,method="POST" if body is not None else "GET")
 with urllib.request.urlopen(r,timeout=timeout) as x:return json.loads(x.read().decode())

def provider(name,base):
 try:
  ids=[str(x["id"]) for x in api(base,"/v1/models",timeout=5).get("data",[]) if x.get("id")]
  return {"name":name,"base":base,"online":True,"models":ids,"loaded":[]}
 except Exception:return {"name":name,"base":base,"online":False,"models":[],"loaded":[]}

def lm_loaded():
 try:
  p=os.environ.get("DREAMLEDGER_LMS_PATH",r"C:\Users\GGPC\.lmstudio\bin\lms.exe")
  t=subprocess.check_output([p,"ps"],stderr=subprocess.DEVNULL,text=True)
  return [x.split()[0] for x in t.splitlines()[1:] if x.split()]
 except Exception:return []

def ollama_loaded():
 try:
  t=subprocess.check_output(["ollama","ps"],stderr=subprocess.DEVNULL,text=True)
  return [x.split()[0] for x in t.splitlines()[1:] if x.split()]
 except Exception:return []

def build_packet(memory):
 e={"timestamp_utc":datetime.now(timezone.utc).isoformat(),"mode":"MULTI_LLM_ITERATIVE_REFINEMENT","economic_truth":{"verified_external_revenue_nzd":0,"settled_external_payments":0,"independent_external_buyers":0},"constraints":CONSTRAINTS,"memory":memory}
 p=os.path.join(ROOT,"BEC-PRIME","data","777","777-LATEST.json")
 if os.path.exists(p):
  try:
   x=json.load(open(p,encoding="utf-8"));e["777"]={"buyer_signal_queue":x.get("buyer_signal_queue",[])[:10],"next_human_action":x.get("next_human_action"),"truth":x.get("truth",{}),"evergreen_expansion":x.get("evergreen_expansion",{})}
  except Exception as ex:e["777_error"]=str(ex)
 supa=os.environ.get("SUPABASE_URL","").rstrip("/");key=os.environ.get("SUPABASE_ANON_KEY","")
 if supa and key:
  try:
   q=urllib.parse.urlencode({"select":"opportunity_id,source,subject,status,expected_value_nzd,expected_cost_nzd,time_budget_minutes,authority_lane,observed_at","order":"expected_value_nzd.desc.nullslast","limit":"50"})
   r=urllib.request.Request(supa+"/rest/v1/cube_opportunities?"+q,headers={"Accept":"application/json","apikey":key,"Authorization":"Bearer "+key})
   with urllib.request.urlopen(r,timeout=20) as z:e["opportunities"]=json.loads(z.read().decode())
  except Exception as ex:e["opportunities_error"]=str(ex)
 return e

def stage(a,role,packet):
 schema={"type":"json_schema","json_schema":{"name":"dreamledger_refinement_stage","strict":True,"schema":{"type":"object","properties":{"role":{"type":"string"},"result":{"type":"string"},"changes":{"type":"array","items":{"type":"string"}},"blockers":{"type":"array","items":{"type":"string"}},"evidence_refs":{"type":"array","items":{"type":"string"}},"human_gate":{"type":"boolean"},"next_action":{"type":"string"},"material_change":{"type":"boolean"}},"required":["role","result","changes","blockers","evidence_refs","human_gate","next_action","material_change"],"additionalProperties":False}}}
 body={"model":a["model"],"messages":[{"role":"system","content":SYSTEM[role]+". Use only supplied evidence. Never invent buyers, payments, revenue, credentials or outcomes. Preserve blockers. Any irreversible external action requires human_gate=true."},{"role":"user","content":json.dumps({"role":role,"packet":packet},separators=(",",":"))}],"response_format":schema,"temperature":0.1,"stream":False}
 return json.loads(api(a["base"],"/v1/chat/completions",body)["choices"][0]["message"]["content"])

def choose(providers):
 pool=[]
 for p in providers.values():
  for m in p["models"]:pool.append((p,m,m in p["loaded"]))
 if not pool:raise RuntimeError("NO_MODELS_ON_LM_STUDIO_OR_OLLAMA")
 used=set();out={}
 for role in ROLES:
  configured=os.environ.get(ENV[role],"").strip()
  desired=None
  if configured:
   desired=configured
  else:
   default={"CRITIC":"local"}.get(role)
   desired=default
  pref=PREFERRED_PROVIDER[role]
  def key(x):return x[0]["name"]+"|"+x[1]
  candidates=[x for x in pool if x[0]["name"]==pref and key(x) not in used]
  if desired:
   hit=next((x for x in candidates if x[1]==desired),None)
   if hit is None:hit=next((x for x in candidates if desired.lower() in x[1].lower()),None)
  else:hit=None
  if hit is None:
   hit=next((x for x in candidates if any(t in x[1].lower() for t in DEFAULT_TERMS[role])),None)
  if hit is None:
   hit=next((x for x in candidates if x[2]),None)
  if hit is None:hit=next(iter(candidates),None)
  if hit is None:
   hit=next((x for x in pool if key(x) not in used),None)
  if hit is None:hit=pool[0]
  out[role]={"provider":hit[0]["name"],"base":hit[0]["base"],"model":hit[1],"was_loaded":hit[2]}
  used.add(key(hit))
 return out

def run():
 sf=os.path.join(RUNS,"multi-llm-state.json")
 try:state=json.load(open(sf,encoding="utf-8")) if os.path.exists(sf) else {}
 except Exception:state={}
 providers={"LM_STUDIO":provider("LM_STUDIO",LM_BASE),"OLLAMA":provider("OLLAMA",OL_BASE)}
 providers["LM_STUDIO"]["loaded"]=lm_loaded();providers["OLLAMA"]["loaded"]=ollama_loaded()
 assignments=choose(providers)
 memory=state.get("memory",{"accepted":[],"open_blockers":[],"evidence_refs":[]})
 history=[];last_sig=None;stable=0
 for n in range(1,ROUNDS+1):
  packet=build_packet(memory);packet["round"]=n;panel=[]
  for role in ROLES:
   z=stage(assignments[role],role,packet);z["provider"]=assignments[role]["provider"];z["model"]=assignments[role]["model"];panel.append(z);packet["panel"]=panel
  syn=panel[-1]
  memory={"accepted":(memory.get("accepted",[])+syn.get("changes",[]))[-40:],"open_blockers":syn.get("blockers",[]),"evidence_refs":list(dict.fromkeys(memory.get("evidence_refs",[])+syn.get("evidence_refs",[])))[-80:],"last_result":syn.get("result"),"last_next_action":syn.get("next_action"),"round":n}
  sig=json.dumps({"changes":syn.get("changes"),"blockers":syn.get("blockers"),"next":syn.get("next_action")},sort_keys=True)
  stable=stable+1 if sig==last_sig else 0;last_sig=sig
  history.append({"round":n,"stages":panel,"memory":memory})
  if stable>=2:break
 ts=datetime.now(timezone.utc).isoformat()
 result={"status":"READY","mode":"MULTI_LLM_ITERATIVE_REFINEMENT","rounds":len(history),"max_rounds":ROUNDS,"providers":providers,"assignments":assignments,"history":history,"final":history[-1],"timestamp_utc":ts}
 json.dump({"memory":memory,"assignments":assignments,"updated_at":ts},open(sf,"w",encoding="utf-8"),indent=2)
 fn=os.path.join(RUNS,"multi-llm-"+datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")+".json")
 json.dump(result,open(fn,"w",encoding="utf-8"),indent=2)
 print(json.dumps(result,indent=2))

if __name__=="__main__":run()
