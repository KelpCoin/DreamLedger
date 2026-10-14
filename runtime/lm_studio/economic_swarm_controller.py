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

CANONICAL_AUDIT_PATH=os.path.join(ROOT,"LAKE","FIGURE8","evidence","MTG-CMD-DIAG-29-CHECKOUT-AUDIT.json")

def run_priority_audit():
    if not os.path.isfile(PRIORITY_AUDIT_SCRIPT):
        return {"status":"BLOCKED_PRIORITY_AUDIT_SCRIPT_MISSING","task_id":"MTG-CMD-DIAG-29-READ-ONLY-AUDIT","external_action_performed":False}
    staging_path=None
    try:
        staging_dir=os.path.join(ROOT,"runtime","lm_studio","state")
        os.makedirs(staging_dir,exist_ok=True)
        staging_path=os.path.join(staging_dir,f"NORTH-STAR-AUDIT-STAGING-{os.getpid()}-{time.time_ns()}.json")
        p=subprocess.run(
            [sys.executable,PRIORITY_AUDIT_SCRIPT,"--json","--output-path",staging_path],
            cwd=ROOT,capture_output=True,text=True,timeout=60
        )
        value=json.loads(p.stdout) if p.stdout.strip() else {}
        if not isinstance(value,dict):
            if os.path.exists(staging_path): os.remove(staging_path)
            return {"status":"BLOCKED_PRIORITY_AUDIT_INVALID_OUTPUT","external_action_performed":False}
        if p.returncode != 0:
            value["controller_observed_returncode"]=p.returncode
            value.setdefault("status","BLOCKED_PRIORITY_AUDIT_FAILED")
            value.pop("artifact_path",None)
            if os.path.exists(staging_path): os.remove(staging_path)
            return value
        value["artifact_path"]=staging_path
        return value
    except Exception as ex:
        if staging_path and os.path.exists(staging_path):
            try: os.remove(staging_path)
            except OSError: pass
        return {"status":"BLOCKED_PRIORITY_AUDIT_EXCEPTION","error_type":type(ex).__name__,"external_action_performed":False}

def attach_worker_assessment(audit, decision, stage_hashes):
    path=audit.get("artifact_path") if isinstance(audit,dict) else None
    if not isinstance(path,str) or not path:
        if isinstance(audit,dict):
            audit["worker_assessment_error"]="NO_STAGED_AUDIT_ARTIFACT"
        return False
    tmp=None
    try:
        root_real=os.path.realpath(ROOT)
        stage_real=os.path.realpath(path)
        if os.path.commonpath([root_real,stage_real]) != root_real or stage_real == os.path.realpath(CANONICAL_AUDIT_PATH):
            raise ValueError("STAGING_PATH_OUTSIDE_ALLOWED_ROOT")
        with open(stage_real,encoding="utf-8") as f:
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
        os.makedirs(os.path.dirname(CANONICAL_AUDIT_PATH),exist_ok=True)
        tmp=CANONICAL_AUDIT_PATH+f".tmp-{os.getpid()}-{time.time_ns()}"
        with open(tmp,"w",encoding="utf-8") as f:
            json.dump(report,f,indent=2,ensure_ascii=False)
            f.write("\n")
        os.replace(tmp,CANONICAL_AUDIT_PATH)
        audit["artifact_path"]=CANONICAL_AUDIT_PATH
        audit["status"]=report["status"]
        audit["worker_assessment_saved"]=True
        try:
            os.remove(stage_real)
        except OSError:
            pass
        return True
    except Exception as ex:
        if tmp and os.path.exists(tmp):
            try: os.remove(tmp)
            except OSError: pass
        audit["worker_assessment_saved"]=False
        audit["worker_assessment_error"]=f"{type(ex).__name__}: {str(ex)[:300]}"
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

def compact_model_snapshot(e, max_chars=5200):
    """Keep the 4K-context scout inside budget while preserving audit facts and hashes."""
    audit=e.get("priority_task_audit",{}) if isinstance(e,dict) else {}
    if not isinstance(audit,dict):
        audit={}
    facts=audit.get("static_facts",{}) if isinstance(audit.get("static_facts"),dict) else {}
    gate=audit.get("gate1_probe",{}) if isinstance(audit.get("gate1_probe"),dict) else {}
    probe_keys=("checked_at_utc","http_status","status_code","branch_classification",
                "response_error_code","error_type","meaning","interpretation")
    compact_probe={k:gate[k] for k in probe_keys if k in gate}
    checks=[]
    for item in facts.get("checks",[])[:8] if isinstance(facts.get("checks"),list) else []:
        if isinstance(item,dict):
            checks.append({"id":item.get("id"),"status":item.get("status"),
                           "finding":str(item.get("finding",""))[:150]})
    sources=[]
    for item in audit.get("source_evidence",[])[:10] if isinstance(audit.get("source_evidence"),list) else []:
        if isinstance(item,dict):
            sources.append({"path":item.get("path"),"status":item.get("status"),
                            "sha256":item.get("sha256"),"bytes":item.get("bytes")})
    blockers=[]
    for item in audit.get("blockers",[])[:8] if isinstance(audit.get("blockers"),list) else []:
        if isinstance(item,dict):
            blockers.append({"id":item.get("id"),"evidence":str(item.get("evidence",""))[:120]})
        else:
            blockers.append(str(item)[:120])
    cells=[]
    for item in e.get("hypothesis_cells",[])[:3] if isinstance(e.get("hypothesis_cells"),list) else []:
        if isinstance(item,dict):
            cells.append({k:item.get(k) for k in ("cell_id","lane_id","transformation_id","status") if k in item})
    compact={
        "timestamp_utc":e.get("timestamp_utc"),
        "economic_truth":e.get("economic_truth",{"verified_external_revenue_nzd":0}),
        "priority_rule":e.get("priority_rule"),
        "constraints":e.get("constraints",[])[:5],
        "hypothesis_cells":cells,
        "priority_task_audit":{
            "task_id":audit.get("task_id"),
            "status":audit.get("status"),
            "source_commit":audit.get("source_commit"),
            "gate1_probe":compact_probe,
            "blockers":blockers,
            "source_evidence":sources,
            "static_facts":{
                "catalog_entry":facts.get("catalog_entry"),
                "landing_price_present":facts.get("landing_price_present"),
                "landing_checkout_present":facts.get("landing_checkout_present"),
                "inline_js_syntax":(facts.get("inline_js_syntax") or {}).get("status") if isinstance(facts.get("inline_js_syntax"),dict) else facts.get("inline_js_syntax"),
                "checks":checks
            }
        },
        "local_private_signals":{
            "status":(e.get("local_private_signals") or {}).get("status","UNKNOWN")
        } if isinstance(e.get("local_private_signals"),dict) else {"status":"UNKNOWN"},
        "opportunities":[
            {k:x.get(k) for k in ("opportunity_id","source","subject","status","expected_value_nzd","expected_cost_nzd","authority_lane")}
            for x in (e.get("opportunities",[])[:4] if isinstance(e.get("opportunities"),list) else [])
            if isinstance(x,dict)
        ],
        "opportunities_status":e.get("opportunities_status")
    }
    raw=json.dumps(compact,separators=(",",":"),ensure_ascii=False)
    if len(raw)<=max_chars:
        return raw
    # If a deployment has unusually long labels/findings, strip lower-priority
    # fields deterministically instead of truncating JSON into invalid syntax.
    compact["opportunities"]=[]
    compact["constraints"]=compact["constraints"][:3]
    compact["priority_task_audit"]["source_evidence"]=sources[:6]
    compact["priority_task_audit"]["static_facts"]["checks"]=[
        {"id":x.get("id"),"status":x.get("status")} for x in checks[:6]
    ]
    return json.dumps(compact,separators=(",",":"),ensure_ascii=False)

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
    body={"model":model,"messages":messages,"temperature":0.1,"stream":False,
          "max_tokens":{"scout":256,"critic":256,"synthesis":384}.get(stage,256)}
    if response_format is not None:
        body["response_format"]=response_format

    def post(payload):
        req=urllib.request.Request(BASE+"/v1/chat/completions",data=json.dumps(payload).encode(),
                                   headers={"Content-Type":"application/json"},method="POST")
        try:
            with urllib.request.urlopen(req,timeout=120) as response:
                return json.loads(response.read().decode())
        except urllib.error.HTTPError as ex:
            # Local inference error bodies are diagnostic evidence. Do not discard
            # them: generic HTTP 400 loops otherwise hide context/schema failures.
            try:
                detail=ex.read(1800).decode("utf-8","replace")
            except Exception:
                detail=""
            detail=" ".join(detail.split())[:1200]
            raise RuntimeError(f"{stage.upper()}_HTTP_{ex.code}: {detail}") from None

    try:
        data=post(body)
    except RuntimeError as ex:
        message=str(ex).lower()
        schema_rejection=(response_format is not None and "_http_400:" in message and
                          any(term in message for term in ("response_format","json_schema","schema","grammar","structured output")))
        if not schema_rejection:
            raise
        # Fallback only for explicit structured-output compatibility errors.
        # JSON is still parsed and schema-checked locally by decide().
        fallback=dict(body)
        fallback["response_format"]={"type":"json_object"}
        try:
            data=post(fallback)
        except Exception as fallback_error:
            raise RuntimeError(f"{ex}; JSON_OBJECT_FALLBACK_FAILED: {fallback_error}") from None

    content=data.get("choices",[{}])[0].get("message",{}).get("content")
    if not isinstance(content,str) or not content.strip():
        raise ValueError(stage.upper()+"_EMPTY_RESPONSE")
    return content.strip()

def decide(e,models):
    task=compact_model_snapshot(e)
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
    try:
        decision=json.loads(synthesis_raw)
    except Exception as ex:
        raise ValueError("SYNTHESIS_JSON_INVALID: "+type(ex).__name__) from None
    required={"decision","opportunity_id","confidence","evidence_refs","blockers","next_action","human_gate","estimated_value_nzd","expiry"}
    if not isinstance(decision,dict) or not required.issubset(decision):
        raise ValueError("SYNTHESIS_SCHEMA_REQUIRED_FIELDS_MISSING")
    if decision.get("decision") not in {"QUALIFY","BUILD","HOLD","REJECT"}:
        raise ValueError("SYNTHESIS_SCHEMA_DECISION_INVALID")
    if not isinstance(decision.get("evidence_refs"),list) or not isinstance(decision.get("blockers"),list):
        raise ValueError("SYNTHESIS_SCHEMA_ARRAY_FIELDS_INVALID")
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
        staged=(snap.get("priority_task_audit") or {}).get("artifact_path")
        if isinstance(staged,str) and os.path.isfile(staged) and os.path.realpath(staged) != os.path.realpath(CANONICAL_AUDIT_PATH):
            try: os.remove(staged)
            except OSError: pass
        return {"status":"BLOCKED","reason":"THREE_MODEL_DECISION_FAILED","models":MODELS,"error":str(ex)}
    d=outcome["decision"]
    priority_audit=snap.get("priority_task_audit",{})
    audit_assessment_saved=attach_worker_assessment(priority_audit,d,outcome["stage_hashes"])
    # 777 remains held unless the synthesis model makes a source-backed BUILD decision.
    seven=run_777() if d.get("decision")=="BUILD" and d.get("evidence_refs") else {"status":"HELD","reason":"NO_AUTONOMOUS_BUILD_WITHOUT_SOURCE_BACKED_BUILD_DECISION"}
    timestamp=datetime.now(timezone.utc).isoformat()
    out={"status":"CYCLE_COMPLETE","mode":"NORTH_STAR_THREE_MODEL","models":MODELS,"seven_seven_seven":seven,"decision":d,"stage_hashes":outcome["stage_hashes"],"timestamp_utc":timestamp,"external_action_performed":False,"economic_truth":snap["economic_truth"],"hypothesis_cells_only":True,"priority_task_id":"MTG-CMD-DIAG-29-READ-ONLY-AUDIT","priority_audit_path":priority_audit.get("artifact_path"),"priority_audit_status":priority_audit.get("status","UNAVAILABLE"),"worker_assessment_saved":audit_assessment_saved,"worker_assessment_error":priority_audit.get("worker_assessment_error"),"read_only_remote_probe_performed":bool(priority_audit.get("gate1_probe",{}).get("checked_at_utc")),"external_commercial_action_performed":False}
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
