import json, os, time, hashlib, urllib.request, urllib.parse
from datetime import datetime, timezone

BASE=os.environ.get("LM_STUDIO_BASE_URL","http://localhost:1234")
MODEL=os.environ.get("DREAMLEDGER_LM_MODEL") or os.environ.get("BECK_LM_MODEL")
INTERVAL=int(os.environ.get("DREAMLEDGER_SWARM_INTERVAL_SECONDS","60"))
ROOT=os.environ.get("DREAMLEDGER_ROOT") or os.getcwd()
RUNS=os.path.join(ROOT,"runtime","lm_studio","runs"); os.makedirs(RUNS,exist_ok=True)
TRACE_DIR=os.path.join(ROOT,"runtime","777"); os.makedirs(TRACE_DIR,exist_ok=True)
TRACE_FILE=os.path.join(TRACE_DIR,"cube-swarm-traces.jsonl")
SUBSTRATE_FILE=os.path.join(ROOT,"runtime","cube","substrate_inventory.json")

def api(path, body=None, timeout=120):
    data=None if body is None else json.dumps(body).encode()
    headers={"Accept":"application/json"}
    if body is not None: headers["Content-Type"]="application/json"
    req=urllib.request.Request(BASE+path,data=data,headers=headers,method="GET" if body is None else "POST")
    with urllib.request.urlopen(req,timeout=timeout) as r: return json.loads(r.read().decode())

def model_call(packet):
    schema={"type":"json_schema","json_schema":{"name":"gauntlet_control","strict":True,"schema":{"type":"object","properties":{"verdict":{"type":"string","enum":["CONTINUE","PREPARE","HUMAN_GATE","QUARANTINE","STOP"]},"next_internal_action":{"type":"string"},"human_gate":{"type":"boolean"},"blockers":{"type":"array","items":{"type":"string"}},"evidence_refs":{"type":"array","items":{"type":"string"}},"reason":{"type":"string"}},"required":["verdict","next_internal_action","human_gate","blockers","evidence_refs","reason"],"additionalProperties":False}}}
    body={"model":MODEL,"messages":[{"role":"system","content":"You are the combined DreamLedger CUBE/SWARM/Gauntlet controller. CUBE organizes economic worlds. SWARM discovers and routes opportunities. Gauntlet is the adversarial veto. Operate autonomously on reversible internal work and permitted read-only research. Never invent evidence. UNKNOWN never becomes PASS. Never send outreach, submit proposals, spend money, use private secrets, accept contracts, publish irreversible changes, or claim settlement. Such actions require HUMAN_GATE. Prefer useful work over waiting: refresh, qualify, build, validate, reconcile, quarantine or prepare the next external action."},{"role":"user","content":json.dumps(packet,separators=(",",":"))}],"response_format":schema,"temperature":0.1,"stream":False}
    return json.loads(api("/v1/chat/completions",body)["choices"][0]["message"]["content"])

def load_substrate():
    try:
        with open(SUBSTRATE_FILE,encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        return {"load_error":str(e),"money_lanes":[],"reusable_transformations":[]}

def build_population(substrate):
    lanes=substrate.get("money_lanes",[]) if isinstance(substrate,dict) else []
    transforms=substrate.get("reusable_transformations",[]) if isinstance(substrate,dict) else []
    surfaces=["SEARCH","COMMUNITY","DIRECTORY","QR","TUMBLR","X","BILLBOARD","OWNED_SITE"]
    population=[]
    for lane in lanes[:10]:
        for transform in transforms[:3]:
            seed={"lane_id":lane.get("id"),"transformation_id":transform.get("id"),"surface":surfaces[len(population)%len(surfaces)]}
            raw=json.dumps(seed,sort_keys=True)
            seed["cell_id"]="CUBE-"+hashlib.sha256(raw.encode()).hexdigest()[:16].upper()
            population.append(seed)
            if len(population)>=10: return population
    return population

def append_trace(record):
    with open(TRACE_FILE,"a",encoding="utf-8") as f:
        f.write(json.dumps(record,separators=(",",":"))+"\n")

def cycle():
    models=api("/v1/models").get("data",[])
    ids=[str(x.get("id")) for x in models]
    chosen=MODEL or (ids[0] if ids else "")
    if not chosen or chosen not in ids: return {"status":"BLOCKED","reason":"NO_USABLE_MODEL","models":ids}
    substrate=load_substrate()
    population=build_population(substrate)
    packet={"time_utc":datetime.now(timezone.utc).isoformat(),
            "economic_truth":{"verified_external_revenue_nzd":0,"settled_external_payments":0,"independent_external_buyers":0},
            "autonomy_mode":"REVERSIBLE_INTERNAL_WORK_PLUS_HUMAN_GATE",
            "surfaces":["CUBE","SWARM","ELOHIM","GAUNTLET","DREAMLEDGER"],
            "required_behavior":["observe","qualify","prepare","verify","queue","quarantine","retry"],
            "forbidden":["fake outcomes","self purchase","unauthorized outreach","unauthorized proposal","spending","secret use","platform bypass","synthetic settlement"],
            "substrate_population":population,
            "evergreen_rule":"5_TO_10_INTERNAL_CANDIDATES; SUPPORT_TOP_1_OR_2_ONLY_AFTER_EXTERNAL_EVIDENCE; REPLICATE_ONLY_VERIFIED"}
    verdict=model_call(packet)
    out={"status":"READY","model":chosen,"control":verdict,"timestamp_utc":datetime.now(timezone.utc).isoformat(),"population":population}
    append_trace({"schema":"DREAMLEDGER/777/CUBE-SWARM-TRACE/v1",
                  "timestamp_utc":out["timestamp_utc"],"model":chosen,
                  "cell_count":len(population),"population":population,
                  "gauntlet_verdict":verdict,"economic_truth":packet["economic_truth"],
                  "rule":"internal computation is not revenue"})
    fn=os.path.join(RUNS,"control-"+datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")+".json")
    with open(fn,"w",encoding="utf-8") as f: json.dump(out,f,indent=2)
    return out

if __name__=="__main__":
    while True:
        try: print(json.dumps(cycle(),indent=2),flush=True)
        except Exception as e: print(json.dumps({"status":"BLOCKED","reason":"CONTROL_CYCLE_FAILED","error":str(e)}),flush=True)
        time.sleep(INTERVAL)
