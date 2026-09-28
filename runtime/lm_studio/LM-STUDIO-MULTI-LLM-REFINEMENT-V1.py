import json, os, time, urllib.request
from datetime import datetime, timezone

BASE=os.environ.get("LM_STUDIO_BASE_URL","http://localhost:1234")
MAX_ROUNDS=int(os.environ.get("DREAMLEDGER_REFINEMENT_ROUNDS","3"))
RUNS=os.path.join(os.environ.get("DREAMLEDGER_ROOT") or os.getcwd(),"runtime","lm_studio","runs")
os.makedirs(RUNS,exist_ok=True)

ROLES=["SCOUT","ANALYST","BUILDER","CRITIC","GAUNTLET","SYNTHESIS"]
ENV={"SCOUT":"DREAMLEDGER_SCOUT_MODEL","ANALYST":"DREAMLEDGER_ANALYST_MODEL","BUILDER":"DREAMLEDGER_BUILDER_MODEL","CRITIC":"DREAMLEDGER_CRITIC_MODEL","GAUNTLET":"DREAMLEDGER_GAUNTLET_MODEL","SYNTHESIS":"DREAMLEDGER_SYNTHESIS_MODEL"}

def get_models():
    req=urllib.request.Request(BASE+"/v1/models",headers={"Accept":"application/json"})
    with urllib.request.urlopen(req,timeout=15) as r:
        return [str(x.get("id")) for x in json.loads(r.read().decode()).get("data",[])]

def call(model,role,packet):
    schema={"type":"json_schema","json_schema":{"name":"multi_llm_stage","strict":True,"schema":{"type":"object","properties":{"role":{"type":"string"},"result":{"type":"string"},"changes":{"type":"array","items":{"type":"string"}},"blockers":{"type":"array","items":{"type":"string"}},"evidence_refs":{"type":"array","items":{"type":"string"}},"human_gate":{"type":"boolean"},"next_action":{"type":"string"}},"required":["role","result","changes","blockers","evidence_refs","human_gate","next_action"],"additionalProperties":False}}}
    system={
      "SCOUT":"Find and refresh externally observable opportunities. Do not invent facts.",
      "ANALYST":"Test qualification, economics, traversability and capability using only evidence.",
      "BUILDER":"Construct the smallest useful internal artifact or execution plan. No external action.",
      "CRITIC":"Try to falsify the current packet. Hunt contradictions, stale evidence and hidden blockers.",
      "GAUNTLET":"Act as adversarial authority gate. Reject unsupported, unauthorized or irreversible external actions.",
      "SYNTHESIS":"Reconcile the panel into the strongest evidence-backed next state. Never erase blockers without evidence."
    }[role]
    body={"model":model,"messages":[{"role":"system","content":system+" UNKNOWN remains UNKNOWN. Confidence is not evidence. Consensus is not truth. Never fabricate buyers, payments, revenue, credentials or outcomes."},{"role":"user","content":json.dumps({"role":role,"packet":packet},separators=(",",":"))}],"response_format":schema,"temperature":0.1,"stream":False}
    req=urllib.request.Request(BASE+"/v1/chat/completions",data=json.dumps(body).encode(),headers={"Content-Type":"application/json"})
    with urllib.request.urlopen(req,timeout=180) as r:
        return json.loads(json.loads(r.read().decode())["choices"][0]["message"]["content"])

def main():
    models=get_models()
    assignments={}
    for role in ROLES:
        configured=os.environ.get(ENV[role])
        assignments[role]=configured or (models[0] if models else "")
        if assignments[role] not in models: raise RuntimeError("MODEL_UNAVAILABLE:"+role)
    packet={"economic_truth":{"verified_external_revenue_nzd":0,"settled_external_payments":0,"independent_external_buyers":0},"mode":"MULTI_LLM_ITERATIVE_REFINEMENT","external_action_policy":"HUMAN_GATE","round":0}
    history=[]
    previous=None
    for n in range(1,MAX_ROUNDS+1):
        packet["round"]=n
        stages=[]
        for role in ROLES:
            out=call(assignments[role],role,packet)
            stages.append(out)
            packet["panel"]=stages
        history.append({"round":n,"stages":stages})
        current=json.dumps(stages,sort_keys=True)
        if current==previous:
            packet["converged"]=True
            break
        previous=current
        packet["accepted_panel"]=stages
    result={"status":"READY","assignments":assignments,"rounds":len(history),"converged":packet.get("converged",False),"panel":history[-1]["stages"],"timestamp_utc":datetime.now(timezone.utc).isoformat()}
    fn=os.path.join(RUNS,"multi-llm-"+datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")+".json")
    with open(fn,"w",encoding="utf-8") as f: json.dump(result,f,indent=2)
    print(json.dumps(result,indent=2))

if __name__=="__main__": main()
