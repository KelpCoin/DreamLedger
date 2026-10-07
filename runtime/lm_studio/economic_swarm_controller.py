import json, os, sys, time, hashlib, subprocess, urllib.request, urllib.parse
from datetime import datetime, timezone
BASE=os.environ.get("LM_STUDIO_BASE_URL","http://localhost:12340")
MODEL=os.environ.get("DREAMLEDGER_LM_MODEL") or os.environ.get("BECK_LM_MODEL")
INTERVAL=int(os.environ.get("DREAMLEDGER_SWARM_INTERVAL_SECONDS","60"))
SUPA=os.environ.get("SUPABASE_URL","").rstrip("/")
KEY=os.environ.get("SUPABASE_ANON_KEY","")
ROOT=os.environ.get("DREAMLEDGER_ROOT") or os.getcwd()
777_PATH=os.path.join(ROOT,"BEC-PRIME","data","777","777-LATEST.json")
SENSOR_PATH=os.path.join(ROOT,"scripts","777_cycle.py")
RUN777=os.path.join(ROOT,"BEC-PRIME","scripts","Run-777.js")
LOG=os.path.join(ROOT,"runtime","lm_studio","runs"); os.makedirs(LOG,exist_ok=True)
SUBSTRATE=os.path.join(ROOT,"runtime","cube","substrate_inventory.json")
TRACE=os.path.join(ROOT,"runtime","777","cube-swarm-traces.jsonl")
os.makedirs(os.path.dirname(TRACE),exist_ok=True)

def load_substrate():
    try: return json.load(open(SUBSTRATE,encoding="utf-8"))
    except Exception as ex: return {"load_error":str(ex),"money_lanes":[],"reusable_transformations":[]}

def population(substrate):
    lanes=substrate.get("money_lanes",[]) if isinstance(substrate,dict) else []
    transforms=substrate.get("reusable_transformations",[]) if isinstance(substrate,dict) else []
    surfaces=["SEARCH","COMMUNITY","DIRECTORY","QR","TUMBLR","X","BILLBOARD","OWNED_SITE"]
    out=[]
    for lane in lanes[:10]:
        for transform in transforms[:3]:
            x={"lane_id":lane.get("id"),"transformation_id":transform.get("id"),"surface":surfaces[len(out)%len(surfaces)]}
            x["cell_id"]="CUBE-"+hashlib.sha256(json.dumps(x,sort_keys=True).encode()).hexdigest()[:16].upper()
            out.append(x)
            if len(out)>=10:return out
    return out

def trace(record):
    with open(TRACE,"a",encoding="utf-8") as f:f.write(json.dumps(record,separators=(",",":"))+"\n")

def get(url,headers=None,timeout=15):
    r=urllib.request.Request(url,headers=headers or {"Accept":"application/json"})
    with urllib.request.urlopen(r,timeout=timeout) as x: return json.loads(x.read().decode())

def local_private_signals():
    try:
        p=subprocess.run([sys.executable,SENSOR_PATH,"--local"],cwd=ROOT,capture_output=True,text=True,timeout=90)
        if p.returncode != 0: return {"status":"ERROR","error":p.stderr[-2000:]}
        lines=[x for x in p.stdout.splitlines() if x.strip()]
        return json.loads(lines[-1]) if lines else {"status":"EMPTY","signals":[]}
    except Exception as ex:
        return {"status":"ERROR","error":str(ex)}

def snapshot():
    sub=load_substrate(); pop=population(sub)
    e={"timestamp_utc":datetime.now(timezone.utc).isoformat(),"economic_truth":{"verified_external_revenue_nzd":0,"settled_external_payments":0,"independent_external_buyers":0},"substrate_population":pop,"constraints":["no self purchase","no simulated revenue","no fake buyers","no autonomous outreach or proposal submission","no autonomous spending","no credential or secret handling","no bypass of platform controls","human gate for irreversible external action"]}
    e["local_private_signals"]=local_private_signals()
    if os.path.exists(777_PATH):
        try:
            latest=json.loads(open(777_PATH,encoding="utf-8").read())
            e["777"]= {
                "buyer_signal_queue": latest.get("buyer_signal_queue",[])[:10],
                "next_human_action": latest.get("next_human_action"),
                "evergreen_expansion": latest.get("evergreen_expansion",{}),
                "truth": latest.get("truth",{})
            }
        except Exception as ex: e["777_error"]=str(ex)
    if SUPA and KEY:
        try:
            q=urllib.parse.urlencode({"select":"opportunity_id,source,subject,status,expected_value_nzd,expected_cost_nzd,time_budget_minutes,authority_lane,observed_at","order":"expected_value_nzd.asc.nullslast","limit":"50"})
            e["opportunities"]=get(SUPA+"/rest/v1/cube_opportunities?"+q,{"apikey":KEY,"Authorization":"Bearer "+KEY})
        except Exception as ex: e["opportunities_error"]=str(ex)
    return e

def decide(e,model):
    schema={"type":"json_schema","json_schema":{"name":"economic_swarm_decision","strict":True,"schema":{"type":"object","properties":{"decision":{"type":"string"},"opportunity_id":{"type":"string"},"confidence":{"type":"number"},"evidence_refs":{"type":"array","items":{"type":"string"}},"blockers":{"type":"array","items":{"type":"string"}},"next_action":{"type":"string"},"human_gate":{"type":"boolean"},"estimated_value_nzd":{"type":"number"},"expiry":{"type":"string"}},"required":["decision","opportunity_id","confidence","evidence_refs","blockers","next_action","human_gate","estimated_value_nzd","expiry"],"additionalProperties":False}}}
    body={"model":model,"messages":[{"role":"system","content":"You are the DreamLedger economic swarm controller. Use only supplied evidence. UNKNOWN never becomes PASS. Discover, qualify, compare, stale-check, prioritize and prepare. Never invent buyers, payments, revenue, credentials, evidence or outcomes. Any irreversible external action requires human_gate=true. Prefer the shortest legitimate route to the first verified NZ$5 transaction."},{"role":"user","content":json.dumps(e,separators=(",",":"))}],"response_format":schema,"temperature":0.1,"stream":False}
    r=urllib.request.Request(BASE+"/v1/chat/completions",data=json.dumps(body).encode(),headers={"Content-Type":"application/json"},method="POST")
    with urllib.request.urlopen(r,timeout=120) as x: return json.loads(json.loads(x.read().decode())["choices"][0]["message"]["content"])

def run_777():
    p=subprocess.run(["node",RUN777],cwd=ROOT,capture_output=True,text=True,timeout=120)
    return {"returncode":p.returncode,"stdout":p.stdout[-4000:],"stderr":p.stderr[-2000:]}

def cycle():
    models=get(BASE+"/v1/models").get("data",[]); ids=[str(x.get("id")) for x in models]; model=MODEL or (ids[0] if ids else "")
    if not model or model not in ids: return {"status":"BLOCKED","reason":"NO_USABLE_LM_STUDIO_MODEL","available_models":ids}
    snap=snapshot(); d=decide(snap,model); seven=run_777(); out={"status":"READY","model":model,"seven_seven_seven":seven,"decision":d,"timestamp_utc":datetime.now(timezone.utc).isoformat()}
    trace({"schema":"DREAMLEDGER/777/CUBE-SWARM-TRACE/v1","timestamp_utc":out["timestamp_utc"],"model":model,"cell_count":len(snap.get("substrate_population",[])),"population":snap.get("substrate_population",[]),"decision":d,"economic_truth":snap["economic_truth"],"rule":"internal computation is not revenue"})
    fn=os.path.join(LOG,"swarm-"+datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")+".json")
    open(fn,"w",encoding="utf-8").write(json.dumps(out,indent=2)); out["run_file"]=fn; return out

once="--once" in sys.argv
while True:
    try: print(json.dumps(cycle(),indent=2),flush=True)
    except Exception as ex: print(json.dumps({"status":"BLOCKED","reason":"SWARM_CYCLE_FAILED","error":str(ex)}),flush=True)
    if once: break
    time.sleep(INTERVAL)
