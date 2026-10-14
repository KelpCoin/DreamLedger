import json, os, sys, time, hashlib, subprocess, urllib.request, urllib.parse
from datetime import datetime, timezone

BASE=os.environ.get("LM_STUDIO_BASE_URL","http://127.0.0.1:1234").rstrip("/")
MODELS={
    "scout": os.environ.get("DREAMLEDGER_SCOUT_MODEL","phi-3-mini-4k-instruct"),
    "critic": os.environ.get("DREAMLEDGER_CRITIC_MODEL","qwen2.5-7b-instruct"),
    "synthesis": os.environ.get("DREAMLEDGER_SYNTHESIS_MODEL","qwen_qwen2.5-vl-7b-instruct"),
}
INTERVAL=max(30,int(os.environ.get("DREAMLEDGER_SWARM_INTERVAL_SECONDS","300")))
SUPA=os.environ.get("SUPABASE_URL","").rstrip("/")
KEY=os.environ.get("SUPABASE_ANON_KEY","")
ROOT=os.environ.get("DREAMLEDGER_ROOT") or os.getcwd()
PATH_777=os.path.join(ROOT,"BEC-PRIME","data","777","777-LATEST.json")
SENSOR_PATH=os.path.join(ROOT,"scripts","777_cycle.py")
RUN777=os.path.join(ROOT,"BEC-PRIME","scripts","Run-777.js")
LOG=os.path.join(ROOT,"runtime","lm_studio","runs"); os.makedirs(LOG,exist_ok=True)
SUBSTRATE=os.path.join(ROOT,"runtime","cube","substrate_inventory.json")
TRACE=os.path.join(ROOT,"runtime","777","cube-swarm-traces.jsonl")
os.makedirs(os.path.dirname(TRACE),exist_ok=True)

def load_substrate():
    try:
        with open(SUBSTRATE,encoding="utf-8") as f: return json.load(f)
    except Exception as ex:
        return {"load_error":str(ex),"money_lanes":[],"reusable_transformations":[]}

def population(substrate):
    lanes=substrate.get("money_lanes",[]) if isinstance(substrate,dict) else []
    transforms=substrate.get("reusable_transformations",[]) if isinstance(substrate,dict) else []
    surfaces=["SEARCH","COMMUNITY","DIRECTORY","BILLBOARD","OWNED_SITE"]
    out=[]
    for lane in lanes[:10]:
        for transform in transforms[:3]:
            x={"lane_id":lane.get("id"),"transformation_id":transform.get("id"),"surface_hypothesis":surfaces[len(out)%len(surfaces)]}
            x["cell_id"]="CUBE-HYPOTHESIS-"+hashlib.sha256(json.dumps(x,sort_keys=True).encode()).hexdigest()[:16].upper()
            x["status"]="HYPOTHESIS_ONLY"
            out.append(x)
            if len(out)>=10:return out
    return out

def trace(record):
    with open(TRACE,"a",encoding="utf-8") as f:
        f.write(json.dumps(record,separators=(",",":"))+"\n")

def get(url,headers=None,timeout=15):
    r=urllib.request.Request(url,headers=headers or {"Accept":"application/json"})
    with urllib.request.urlopen(r,timeout=timeout) as x:
        return json.loads(x.read().decode())

def local_private_signals():
    try:
        p=subprocess.run([sys.executable,SENSOR_PATH,"--local"],cwd=ROOT,capture_output=True,text=True,timeout=90)
        if p.returncode != 0: return {"status":"ERROR","error":p.stderr[-2000:]}
        lines=[x for x in p.stdout.splitlines() if x.strip()]
        return json.loads(lines[-1]) if lines else {"status":"EMPTY","signals":[]}
    except Exception as ex:
        return {"status":"ERROR","error":str(ex)}


PRIORITY_AUDIT_SCRIPT=os.path.join(ROOT,"runtime","lm_studio","north_star_priority_audit.py")

def run_priority_audit():
    if not os.path.isfile(PRIORITY_AUDIT_SCRIPT):
        return {"status":"BLOCKED_PRIORITY_AUDIT_SCRIPT_MISSING","task_id":"MTG-CMD-DIAG-29-READ-ONLY-AUDIT","external_action_performed":False}
    try:
        p=subprocess.run([sys.executable,PRIORITY_AUDIT_SCRIPT,"--json"],cwd=ROOT,capture_output=True,text=True,timeout=60)
        value=json.loads(p.stdout) if p.stdout.strip() else {}
        if not isinstance(value,dict):
            return {"status":"BLOCKED_PRIORITY_AUDIT_INVALID_OUTPUT","external_action_performed":False}
        if p.returncode != 0:
            value["controller_observed_returncode"]=p.returncode
            value.setdefault("status","BLOCKED_PRIORITY_AUDIT_FAILED")
        return value
    except Exception as ex:
        return {"status":"BLOCKED_PRIORITY_AUDIT_EXCEPTION","error_type":type(ex).__name__,"external_action_performed":False}

def attach_worker_assessment(audit, decision, stage_hashes):
    path=audit.get("artifact_path") if isinstance(audit,dict) else None
    if not isinstance(path,str) or not path:
        return False
    try:
        with open(path,encoding="utf-8") as f:
            report=json.load(f)
        report["worker_assessment"]={
            "decision":decision.get("decision","HOLD"),
            "confidence":decision.get("confidence",0),
            "evidence_refs":decision.get("evidence_refs",[]),
            "blockers":decision.get("blockers",[]),
            "next_action":decision.get("next_action","Review the source evidence bundle."),
            "human_gate":True,
            "estimated_value_nzd":0,
            "stage_hashes":stage_hashes,
            "assessed_at_utc":datetime.now(timezone.utc).isoformat()
        }
        report["status"]="BLOCKED_GATE1_CONFIG_MISSING" if report.get("gate1_probe",{}).get("branch_classification")=="STRIPE_CONFIG_MISSING" else "AUDIT_INCOMPLETE_REQUIRES_REVIEW"
        report["payment_verified"]=False
        report["fulfillment_verified"]=False
        report["verified_revenue_nzd"]=0
        report["external_action_performed"]=False
        tmp=path+".tmp"
        with open(tmp,"w",encoding="utf-8") as f:
            json.dump(report,f,indent=2,ensure_ascii=False)
            f.write("\\n")
        os.replace(tmp,path)
        return True
    except Exception:
        return False

def snapshot():
    sub=load_substrate(); pop=population(sub)
    e={
        "timestamp_utc":datetime.now(timezone.utc).isoformat(),
        "economic_truth":{"verified_external_revenue_nzd":0,"settled_external_payments":0,"independent_external_buyers":0},
        "hypothesis_cells":pop,
        "priority_rule":"prefer source-backed B2B/creator/commerce problems with reusable fulfilment; MTG is current first productized-service candidate, not verified revenue",
        "constraints":[
            "ideas and generated cells are hypotheses, not observed demand",
            "no self purchase, simulated revenue, fake buyers, autonomous outreach, bidding, spending, credential handling or public action",
            "no database mutation from this local research loop",
            "any irreversible external action requires human_gate=true",
            "UNKNOWN never becomes PASS",
            "do not prioritize by candidate score alone; require external demand and fulfilment evidence"
        ]
    }
    e["priority_task_audit"]=run_priority_audit()
    e["local_private_signals"]=local_private_signals()
    if os.path.exists(PATH_777):
        try:
            with open(PATH_777,encoding="utf-8") as f: latest=json.load(f)
            e["777"]={
                "buyer_signal_queue":latest.get("buyer_signal_queue",[])[:10],
                "next_human_action":latest.get("next_human_action"),
                "evergreen_expansion":latest.get("evergreen_expansion",{}),
                "truth":latest.get("truth",{})
            }
        except Exception as ex:
            e["777_error"]=str(ex)
    if SUPA and KEY:
        try:
            q=urllib.parse.urlencode({"select":"opportunity_id,source,subject,status,expected_value_nzd,expected_cost_nzd,time_budget_minutes,authority_lane,observed_at","order":"expected_value_nzd.desc.nullslast","limit":"30"})
            e["opportunities"]=get(SUPA+"/rest/v1/cube_opportunities?"+q,{"apikey":KEY,"Authorization":"Bearer "+KEY})
        except Exception as ex:
            e["opportunities_error"]=str(ex)
    else:
        e["opportunities_status"]="UNAVAILABLE_NO_SUPABASE_READ_CREDENTIALS"
    return e

DECISION_SCHEMA={"type":"json_schema","json_schema":{"name":"economic_swarm_decision","strict":True,"schema":{
    "type":"object",
    "properties":{
        "decision":{"type":"string","enum":["QUALIFY","BUILD","HOLD","REJECT"]},
        "opportunity_id":{"type":"string"},
        "confidence":{"type":"number"},
        "evidence_refs":{"type":"array","items":{"type":"string"}},
        "blockers":{"type":"array","items":{"type":"string"}},
        "next_action":{"type":"string"},
        "human_gate":{"type":"boolean"},
        "estimated_value_nzd":{"type":"number"},
        "expiry":{"type":"string"}
    },
    "required":["decision","opportunity_id","confidence","evidence_refs","blockers","next_action","human_gate","estimated_value_nzd","expiry"],
    "additionalProperties":False
}}}

def call_model(stage,model,messages,response_format=None):
    body={"model":model,"messages":messages,"temperature":0.1,"stream":False}
    if response_format is not None: body["response_format"]=response_format
    req=urllib.request.Request(BASE+"/v1/chat/completions",data=json.dumps(body).encode(),headers={"Content-Type":"application/json"},method="POST")
    with urllib.request.urlopen(req,timeout=120) as x: data=json.loads(x.read().decode())
    content=data.get("choices",[{}])[0].get("message",{}).get("content")
    if not isinstance(content,str) or not content.strip(): raise ValueError(stage.upper()+"_EMPTY_RESPONSE")
    return content.strip()

def decide(e,models):
    task=json.dumps(e,separators=(",",":"),ensure_ascii=False)
    scout=call_model("scout",models["scout"],[
        {"role":"system","content":"You are SCOUT for DreamLedger's North Star economic research loop. The primary task is the supplied MTG Commander checkout-to-delivery audit in priority_task_audit. Examine the provided source evidence and prioritize the smallest reversible repair that advances a real paid order. Separate source facts from inference, and cite supplied repository paths only. Do not claim deployment, buyer demand, a valid Stripe key, settlement, fulfillment, profit, or revenue unless the snapshot proves it. Never recommend outreach, spending, public posting, credential changes, production mutation, or checkout creation."},
        {"role":"user","content":"Identify the strongest source-backed opportunity and one bounded internal artifact that could reduce uncertainty. Return concise findings with evidence references and explicit unknowns. Snapshot:\n"+task}
    ])
    critic=call_model("critic",models["critic"],[
        {"role":"system","content":"You are CRITIC. Adversarially review the scout's MTG checkout-to-delivery audit. Compare every claim against the supplied source excerpts, hashes, static checks, and Gate 1 probe status. Reject unsupported claims about deployment, key validity, buyer intent, payment settlement, fulfillment, profits, or revenue. Name the missing proof and one smallest reversible internal repair. Do not execute external actions."},
        {"role":"user","content":"Snapshot:\n"+task+"\n\nSCOUT FINDINGS:\n"+scout}
    ])
    synthesis_raw=call_model("synthesis",models["synthesis"],[
        {"role":"system","content":"You are the DreamLedger North Star SYNTHESIS/JUDGE preparation role for the current MTG Commander checkout-to-delivery audit. Resolve scout and critic into exactly the required JSON decision schema. Use only evidence references present in the snapshot, especially priority_task_audit source paths. Prefer the shortest verified step that removes a blocker to a future independent paid order. Do not contact buyers, spend, publish, change credentials, mutate production, or create checkout. Keep estimated_value_nzd at 0; human_gate must be true. If anything important is unverified, choose HOLD or QUALIFY and name the exact missing evidence. Do not claim Gauntlet/Elohim approval."},
        {"role":"user","content":"SNAPSHOT:\n"+task+"\n\nSCOUT:\n"+scout+"\n\nCRITIC:\n"+critic+"\n\nReturn the required JSON object only."}
    ],DECISION_SCHEMA)
    decision=json.loads(synthesis_raw)
    allowed_refs=set()
    def walk(value):
        if isinstance(value,dict):
            for k,v in value.items():
                if k in {"source_url","url","evidence_ref","source_ref","opportunity_id","path","source_path","relative_path","artifact_path"} and isinstance(v,str): allowed_refs.add(v)
                walk(v)
        elif isinstance(value,list):
            for item in value: walk(item)
    walk(e)
    refs=decision.get("evidence_refs",[])
    if not isinstance(refs,list): raise ValueError("DECISION_EVIDENCE_REFS_INVALID")
    # Model output may refer to a local artifact name; it cannot introduce new external evidence.
    decision["evidence_refs"]=[x for x in refs if isinstance(x,str) and x in allowed_refs]
    if decision.get("decision") in {"BUILD","QUALIFY"} and not decision["evidence_refs"]:
        decision["decision"]="HOLD"
        decision.setdefault("blockers",[]).append("NO_SNAPSHOT_EVIDENCE_REFERENCE")
    if decision.get("estimated_value_nzd",0)>0 and not decision["evidence_refs"]:
        decision["estimated_value_nzd"]=0
        decision["blockers"].append("UNSUPPORTED_VALUE_RESET_TO_ZERO")
    decision["human_gate"]=True
    decision["estimated_value_nzd"]=0
    return {"decision":decision,"stage_hashes":{
        "scout":"sha256:"+hashlib.sha256(scout.encode()).hexdigest(),
        "critic":"sha256:"+hashlib.sha256(critic.encode()).hexdigest(),
        "synthesis":"sha256:"+hashlib.sha256(synthesis_raw.encode()).hexdigest()
    }}

def run_777():
    p=subprocess.run(["node",RUN777],cwd=ROOT,capture_output=True,text=True,timeout=120)
    return {"returncode":p.returncode,"stdout":p.stdout[-4000:],"stderr":p.stderr[-2000:]}

def cycle():
    try:
        available=get(BASE+"/v1/models").get("data",[])
        ids=[str(x.get("id")) for x in available]
    except Exception as ex:
        return {"status":"BLOCKED","reason":"LM_STUDIO_UNAVAILABLE","endpoint":BASE,"error":str(ex)}
    missing={role:model for role,model in MODELS.items() if model not in ids}
    if missing or len(set(MODELS.values()))!=3:
        return {"status":"BLOCKED","reason":"THREE_DISTINCT_MODELS_REQUIRED","required_models":MODELS,"missing_models":missing,"available_models":ids}
    snap=snapshot()
    try:
        outcome=decide(snap,MODELS)
    except Exception as ex:
        return {"status":"BLOCKED","reason":"THREE_MODEL_DECISION_FAILED","models":MODELS,"error":str(ex)}
    d=outcome["decision"]
    priority_audit=snap.get("priority_task_audit",{})
    audit_assessment_saved=attach_worker_assessment(priority_audit,d,outcome["stage_hashes"])
    # 777 remains held unless the synthesis model makes a source-backed BUILD decision.
    seven=run_777() if d.get("decision")=="BUILD" and d.get("evidence_refs") else {"status":"HELD","reason":"NO_AUTONOMOUS_BUILD_WITHOUT_SOURCE_BACKED_BUILD_DECISION"}
    timestamp=datetime.now(timezone.utc).isoformat()
    out={"status":"CYCLE_COMPLETE","mode":"NORTH_STAR_THREE_MODEL","models":MODELS,"seven_seven_seven":seven,"decision":d,"stage_hashes":outcome["stage_hashes"],"timestamp_utc":timestamp,"external_action_performed":False,"economic_truth":snap["economic_truth"],"hypothesis_cells_only":True,"priority_task_id":"MTG-CMD-DIAG-29-READ-ONLY-AUDIT","priority_audit_path":priority_audit.get("artifact_path"),"priority_audit_status":priority_audit.get("status","UNAVAILABLE"),"worker_assessment_saved":audit_assessment_saved,"read_only_remote_probe_performed":bool(priority_audit.get("gate1_probe",{}).get("checked_at_utc")),"external_commercial_action_performed":False}
    trace({"schema":"DREAMLEDGER/777/CUBE-SWARM-TRACE/v2","timestamp_utc":timestamp,"models":MODELS,"hypothesis_cell_count":len(snap.get("hypothesis_cells",[])),"decision":d,"stage_hashes":outcome["stage_hashes"],"economic_truth":snap["economic_truth"],"external_action_performed":False,"rule":"inference and internal compilation are not revenue"})
    fn=os.path.join(LOG,"north-star-"+datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")+".json")
    with open(fn,"w",encoding="utf-8") as f: json.dump(out,f,indent=2)
    out["run_file"]=fn
    return out

once="--once" in sys.argv
while True:
    try: print(json.dumps(cycle(),indent=2),flush=True)
    except Exception as ex: print(json.dumps({"status":"BLOCKED","reason":"SWARM_CYCLE_FAILED","error":str(ex)}),flush=True)
    if once: break
    time.sleep(INTERVAL)
