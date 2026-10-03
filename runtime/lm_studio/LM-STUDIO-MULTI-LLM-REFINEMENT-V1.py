import base64, json, mimetypes, os, urllib.request
from datetime import datetime, timezone

BASE=os.environ.get("LM_STUDIO_BASE_URL","http://localhost:1234").rstrip("/")
MAX_ROUNDS=int(os.environ.get("DREAMLEDGER_REFINEMENT_ROUNDS","3"))
RUNS=os.path.join(os.environ.get("DREAMLEDGER_ROOT") or os.getcwd(),"runtime","lm_studio","runs")
os.makedirs(RUNS,exist_ok=True)

MODEL_ENV={
    "CREATOR":"DREAMLEDGER_CREATOR_MODEL",
    "CRITIC":"DREAMLEDGER_CRITIC_MODEL",
    "SYNTHESIS":"DREAMLEDGER_SYNTHESIS_MODEL",
}
LEGACY_ENV={
    "CREATOR":("DREAMLEDGER_BUILDER_MODEL","DREAMLEDGER_SCOUT_MODEL"),
    "CRITIC":("DREAMLEDGER_CRITIC_MODEL","DREAMLEDGER_GAUNTLET_MODEL"),
    "SYNTHESIS":("DREAMLEDGER_SYNTHESIS_MODEL",),
}

def get_models():
    req=urllib.request.Request(BASE+"/v1/models",headers={"Accept":"application/json"})
    with urllib.request.urlopen(req,timeout=15) as r:
        return [str(x.get("id")) for x in json.loads(r.read().decode()).get("data",[]) if x.get("id")]

def _configured(role):
    value=os.environ.get(MODEL_ENV[role],"").strip()
    if value:
        return value
    for key in LEGACY_ENV[role]:
        value=os.environ.get(key,"").strip()
        if value:
            return value
    return ""

def assign_models(models):
    assignments={role:_configured(role) for role in ("CREATOR","CRITIC","SYNTHESIS")}
    missing=[r for r,v in assignments.items() if not v]
    if missing:
        raise RuntimeError("THREE_MODEL_CONFIG_REQUIRED:" + ",".join(missing))
    values=list(assignments.values())
    if len(set(values)) != 3:
        raise RuntimeError("MINIMUM_THREE_DISTINCT_MODELS_REQUIRED")
    unavailable=[r+":"+assignments[r] for r in assignments if assignments[r] not in models]
    if unavailable:
        raise RuntimeError("MODEL_NOT_EXPOSED:" + ",".join(unavailable))
    vision=os.environ.get("DREAMLEDGER_VISION_MODEL","").strip() or assignments["CRITIC"]
    if vision not in values:
        raise RuntimeError("VISION_MODEL_MUST_BE_ONE_OF_THREE")
    return assignments, vision

def load_image_part(path):
    p=os.path.abspath(path)
    with open(p,"rb") as f:
        data=base64.b64encode(f.read()).decode("ascii")
    mime=mimetypes.guess_type(p)[0] or "image/png"
    if mime not in ("image/png","image/jpeg","image/webp"):
        raise RuntimeError("UNSUPPORTED_VISION_IMAGE_TYPE:"+mime)
    return {"type":"image_url","image_url":{"url":"data:"+mime+";base64,"+data}}

def call(model,role,packet,vision_images=None):
    schema={"type":"json_schema","json_schema":{"name":"multi_llm_stage","strict":True,"schema":{"type":"object","properties":{"role":{"type":"string"},"result":{"type":"string"},"changes":{"type":"array","items":{"type":"string"}},"blockers":{"type":"array","items":{"type":"string"}},"evidence_refs":{"type":"array","items":{"type":"string"}},"human_gate":{"type":"boolean"},"next_action":{"type":"string"}},"required":["role","result","changes","blockers","evidence_refs","human_gate","next_action"],"additionalProperties":False}}}
    systems={
      "CREATOR":"Create the strongest bounded candidate, transformation, artifact or execution plan from the supplied evidence. You are the creator in a three-model refinement loop. Never perform external action.",
      "CRITIC":"Attack the creator output. Hunt contradictions, stale evidence, missing source support, economic leakage, scope errors and hidden blockers. You are also the designated vision/OCR model when images are supplied. Never certify truth.",
      "SYNTHESIS":"Reconcile creator and critic outputs into one evidence-backed next state. Preserve unresolved blockers. You cannot authorize actions prohibited by the control boundary."
    }
    content=[{"type":"text","text":json.dumps({"role":role,"packet":packet},separators=(",",":"))}]
    if role=="CRITIC" and vision_images:
        for path in vision_images:
            content.append(load_image_part(path))
    body={"model":model,"messages":[{"role":"system","content":systems[role]+" UNKNOWN remains UNKNOWN. Confidence is not evidence. Consensus is not truth. Never fabricate buyers, payments, revenue, credentials or outcomes."},{"role":"user","content":content}],"response_format":schema,"temperature":0.1,"stream":False}
    req=urllib.request.Request(BASE+"/v1/chat/completions",data=json.dumps(body).encode(),headers={"Content-Type":"application/json"})
    with urllib.request.urlopen(req,timeout=180) as r:
        return json.loads(json.loads(r.read().decode())["choices"][0]["message"]["content"])

def main():
    models=get_models()
    assignments,vision=assign_models(models)
    image_env=os.environ.get("DREAMLEDGER_VISION_IMAGE_PATHS","").strip()
    vision_images=[x.strip() for x in image_env.split(";") if x.strip()]
    packet={"economic_truth":{"verified_external_revenue_nzd":0,"settled_external_payments":0,"independent_external_buyers":0},"mode":"THREE_MODEL_ITERATIVE_REFINEMENT","external_action_policy":"HUMAN_GATE","round":0,"vision_model":vision,"vision_inputs":vision_images}
    history=[]
    previous=None
    for n in range(1,MAX_ROUNDS+1):
        packet["round"]=n
        creator=call(assignments["CREATOR"],"CREATOR",packet)
        packet["creator"]=creator
        critic=call(assignments["CRITIC"],"CRITIC",packet,vision_images)
        packet["critic"]=critic
        synthesis=call(assignments["SYNTHESIS"],"SYNTHESIS",packet)
        packet["synthesis"]=synthesis
        stages=[creator,critic,synthesis]
        history.append({"round":n,"stages":stages})
        current=json.dumps(synthesis,sort_keys=True)
        if current==previous:
            packet["converged"]=True
            break
        previous=current
        packet["accepted_state"]=synthesis
    result={"status":"READY","model_assignments":assignments,"vision_model":vision,"distinct_model_count":len(set(assignments.values())),"rounds":len(history),"converged":packet.get("converged",False),"panel":history[-1]["stages"],"timestamp_utc":datetime.now(timezone.utc).isoformat()}
    fn=os.path.join(RUNS,"multi-llm-"+datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")+".json")
    with open(fn,"w",encoding="utf-8") as f: json.dump(result,f,indent=2)
    print(json.dumps(result,indent=2))

if __name__=="__main__": main()
