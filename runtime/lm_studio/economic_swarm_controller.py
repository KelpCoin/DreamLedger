import json, os, sys, time, subprocess, urllib.request, urllib.parse
from datetime import datetime, timezone

ROOT=os.environ.get("DREAMLEDGER_ROOT") or os.getcwd()
RUNS=os.path.join(ROOT,"runtime","lm_studio","runs"); os.makedirs(RUNS,exist_ok=True)
ROUNDS=max(2,int(os.environ.get("DREAMLEDGER_REFINEMENT_ROUNDS","5")))
INTERVAL=int(os.environ.get("DREAMLEDGER_SWARM_INTERVAL_SECONDS","60"))
LM_BASE=os.environ.get("LM_STUDIO_BASE_URL","http://127.0.0.1:12340").rstrip("/")
OL_BASE=os.environ.get("DREAMLEDGER_OLLAMA_BASE_URL","http://127.0.0.1:11434").rstrip("/")

ROLES=["SCOUT","ANALYST","BUILDER","CRITIC","GAUNTLET","SYNTHESIS"]
ENV={
 "SCOUT":"DREAMLEDGER_SCOUT_MODEL","ANALYST":"DREAMLEDGER_ANALYST_MODEL",
 "BUILDER":"DREAMLEDGER_BUILDER_MODEL","CRITIC":"DREAMLEDGER_LM_MODEL_CRITIC",
 "GAUNTLET":"DREAMLEDGER_GAUNTLET_MODEL","SYNTHESIS":"DREAMLEDGER_SYNTHESIS_MODEL"
}
DEFAULT={
 "SCOUT":"DREAMLEDGER_LM_MODEL_CREATIVE:qwen2.5-7b-instruct",
 "ANALYST":"DREAMLEDGER_LM_MODEL_ANALYST:openai/gpt-oss-20b",
 "BUILDER":"DREAMLEDGER_LM_MODEL_CREATIVE:qwen2.5-coder-14b-instruct",
 "CRITIC":"DREAMLEDGER_LM_MODEL_CRITIC:local",
 "GAUNTLET":"DREAMLEDGER_GAUNTLET_MODEL:local",
 "SYNTHESIS":"DREAMLEDGER_LM_MODEL_CREATIVE:qwen2.5-7b-instruct"
}
PROMPTS={
"SCOUT":"discover and refresh opportunities from supplied evidence; never invent facts",
"ANALYST":"qualify economics, evidence, freshness, traversability and assumptions",
"BUILDER":"construct the smallest useful internal artifact or preparation; never act externally",
"CRITIC":"falsify the packet; hunt contradictions, stale evidence and hidden blockers",
"GAUNTLET":"adversarially reject unsupported, unauthorized, irreversible or prohibited actions",
"SYNTHESIS":"reconcile the panel into the strongest evidence-backed next state while preserving blockers"
}
CONSTRAINTS=["no fake buyers","no simulated revenue","no self purchase","no autonomous outreach","no autonomous spending","no secret handling","no platform bypass","human gate for irreversible external action","UNKNOWN remains UNKNOWN","consensus is not truth","confidence is not evidence"]

def req(base,path,body=None,timeout=180):
 d=None if body is None else json.dumps(body,separators=(",",":")).encode()
 h={"Accept":"application/json"}; 
 if body is not None:h["Content-Type"]="application/json"
 r=urllib.request.Request(base+path,data=d,headers=h,method="POST" if body is not None else "GET")
 with urllib.request.urlopen(r,timeout=timeout) as x:return json.loads(x.read().decode())

def provider(name,base):
 try:
  ids=[str(x["id"]) for x in req(base,"/v1/models",timeout=5).get("data",[]) if x.get("id")]
  return {"name":name,"base":base,"online":True,"models":ids,"loaded":[]}
 except Exception:return {"name":name,"base":base,"online":False,"models":[],"loaded":[]}

def loaded_lm():
 try:
  p=os.environ.get("DREAMLEDGER_LMS_PATH",r"C:\Users\GGPC\.lmstudio\bin\lms.exe")
  t=subprocess.check_output([p,"ps"],stderr=subprocess.DEVNULL,text=True)
  return [x.split()[0] for x in t.splitlines()[1:] if x.split()]
 except Exception:return []

def loaded_ollama():
 try:
  t=subprocess.check_output(["ollama","ps"],stderr=subprocess.DEVNULL,text=True)
  return [x.split()[0] for x in t.splitlines()[1:] if x.split()]
 except Exception:return []

def packet(memory):
 e={"timestamp_utc":datetime.now(timezone.utc).isoformat(),"mode":"MULTI_LLM_ITERATIVE_REFINEMENT","economic_truth":{"verified_external_revenue_nzd":0,"settled_external_payments":0,"independent_external_buyers":0},"constraints":CONSTRAINTS,"memory":memory}
 p=os.path.join(ROOT,"BEC-PRIME","data","777","777-LATEST.json")
 if os.path.exists(p):
  try:
   x=json.load(open(p,encoding="utf-8")); e["777"]={"buyer_signal_queue":x.get("buyer_signal_queue",[])[:10],"next_human_action":x.get("next_human_action"),"truth":x.get("truth",{}),"evergreen_expansion":x.get("evergreen_expansion",{})}
  except Exception as ex:e["777_error"]=str(ex)
 return e

def stage(a,role,pk):
 schema={"type":"json_schema","json_schema":{"name":"stage","strict":True,"schema":{"type":"object","properties":{"role":{"type":"string"},"result":{"type":"string"},"changes":{"type":"array","items":{"type":"string"}},"blockers":{"type":"array","items":{"type":"string"}},"evidence_refs":{"type":"array","items":{"type":"string"}},"human_gate":{"type":"boolean"},"next_action":{"type":"string"},"material_change":{"type":"boolean"}},"required":["role","result","changes","blockers","evidence_refs","human_gate","next_action","material_change"],"additionalProperties":False}}}
 body={"model":a["model"],"messages":[{"role":"system","content":PROMPTS[role]+". Use only supplied evidence. Never invent buyers, payments, revenue, credentials or outcomes. Preserve blockers. Any irreversible external action requires human_gate=true."},{"role":"user","content":json.dumps({"role":role,"packet":pk},separators=(",",":"))}],"response_format":schema,"temperature":0.1,"stream":False}
 return json.loads(req(a["base"],"/v1/chat/completions",body)["choices"][0]["message"]["content"])

def choose(provs):
 allm=[]
 for p in provs.values():
  for m in p["models"]:allm.append((p,m,m in p["loaded"]))
 if not allm:raise RuntimeError("NO_MODELS_ON_LM_STUDIO_OR_OLLAMA")
 out={}
 used=set()
 for role in ROLES:
  raw=os.environ.get(ENV[role],"").strip()
  if not raw:
   raw=DEFAULT[role]
   envn,fallback=(raw.split(":",1)+[""])[:2]
   raw=os.environ.get(envn,"") or fallback
  hit=None
  if raw=="local":
   hit=next((x for x in allm if x[0]["name"]=="LM_STUDIO" and x[1]=="local"),None)
  if not hit:
   hit=next((x for x in allm if x[1]==raw and (x[0]["name"]+"|"+x[1]) not in used),None)
  if not hit:
   terms={"SCOUT":["creative","qwen2.5-7b"],"ANALYST":["gpt-oss","deepseek","qwen"],"BUILDER":["coder","qwen2.5-coder"],"CRITIC":["local","phi"],"GAUNTLET":["local","phi"],"SYNTHESIS":["creative","qwen2.5-7b"]}[role]
   for term in terms:
    hit=next((x for x in allm if term.lower() in x[1].lower() and (x[0]["name"]+"|"+x[1]) not in used),None)
    if hit:break
  if not hit:
   hit=next((x for x in allm if x[2] and (x[0]["name"]+"|"+x[1]) not in used),None)
  if not hit:
   hit=next((x for x in allm if (x[0]["name"]+"|"+x[1]) not in used),None)
  if not hit:hit=allm[0]
  out[role]={"provider":hit[0]["name"],"base":hit[0]["base"],"model":hit[1],"was_loaded":hit[2]}
  used.add(hit[0]["name"]+"|"+hit[1])
 return out

def run():
 sf=os.path.join(RUNS,"multi-llm-state.json")
 try:state=json.load(open(sf,encoding="utf-8")) if os.path.exists(sf) else {}
 except Exception:state={}
 p={"LM_STUDIO":provider("LM_STUDIO",LM_BASE),"OLLAMA":provider("OLLAMA",OL_BASE)}
 p["LM_STUDIO"]["loaded"]=loaded_lm();p["OLLAMA"]["loaded"]=loaded_ollama()
 a=choose(p);mem=state.get("memory",{"accepted":[],"open_blockers":[],"evidence_refs":[]})
 hist=[]; last=None; stable=0
 for n in range(1,ROUNDS+1):
  pk=packet(mem);pk["round"]=n;panel=[]
  for role in ROLES:
   z=stage(a[role],role,pk);z["provider"]=a[role]["provider"];z["model"]=a[role]["model"];panel.append(z);pk["panel"]=panel
  s=panel[-1];mem={"accepted":(mem.get("accepted",[])+s.get("changes",[]))[-40:],"open_blockers":s.get("blockers",[]),"evidence_refs":list(dict.fromkeys(mem.get("evidence_refs",[])+s.get("evidence_refs",[])))[-80:],"last_result":s.get("result"),"last_next_action":s.get("next_action"),"round":n}
  sig=json.dumps({"changes":s.get("changes"),"blockers":s.get("blockers"),"next":s.get("next_action")},sort_keys=True)
  stable=stable+1 if sig==last else 0;last=sig
  hist.append({"round":n,"stages":panel,"memory":mem})
  if stable>=2:break
 result={"status":"READY","mode":"MULTI_LLM_ITERATIVE_REFINEMENT","rounds":len(hist),"max_rounds":ROUNDS,"providers":p,"assignments":a,"history":hist,"final":hist[-1],"timestamp_utc":datetime.now(timezone.utc).isoformat()}
 json.dump({"memory":mem,"assignments":a,"updated_at":result["timestamp_utc"]},open(sf,"w",encoding="utf-8"),indent=2)
 fn=os.path.join(RUNS,"multi-llm-"+datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")+".json")
 json.dump(result,open(fn,"w",encoding="utf-8"),indent=2)
 print(json.dumps(result,indent=2))

if __name__=="__main__":run()
