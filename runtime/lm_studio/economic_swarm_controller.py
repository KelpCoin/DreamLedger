import json
import os
import sys
import time
import urllib.request
import urllib.error

BASE = os.environ.get("LM_STUDIO_BASE_URL", "http://localhost:1234")
MODEL = os.environ.get("DREAMLEDGER_LM_MODEL") or os.environ.get("BECK_LM_MODEL")

def get_json(path):
    req = urllib.request.Request(BASE + path, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read().decode("utf-8"))

def ask_model(evidence):
    schema = {
        "type": "json_schema",
        "json_schema": {
            "name": "economic_swarm_decision",
            "strict": True,
            "schema": {
                "type": "object",
                "properties": {
                    "decision": {"type": "string"},
                    "opportunity_id": {"type": "string"},
                    "confidence": {"type": "number"},
                    "evidence_refs": {"type": "array", "items": {"type": "string"}},
                    "blockers": {"type": "array", "items": {"type": "string"}},
                    "next_action": {"type": "string"},
                    "human_gate": {"type": "boolean"},
                    "estimated_value_nzd": {"type": "number"},
                    "expiry": {"type": "string"}
                },
                "required": ["decision","opportunity_id","confidence","evidence_refs","blockers","next_action","human_gate","estimated_value_nzd","expiry"],
                "additionalProperties": False
            }
        }
    }
    body = {
        "model": MODEL,
        "messages": [
            {"role":"system","content":(
                "You are the DreamLedger economic swarm controller. "
                "Reason only from supplied evidence. Never invent buyers, payments, revenue, credentials, "
                "or external outcomes. UNKNOWN never becomes PASS. Never authorize spending, outreach, "
                "submission, account access, payment, or public release. Those require human_gate=true. "
                "Return only the requested JSON."
            )},
            {"role":"user","content":json.dumps(evidence, separators=(",",":"))}
        ],
        "response_format": schema,
        "temperature": 0.1,
        "stream": False
    }
    raw = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        BASE + "/v1/chat/completions",
        data=raw,
        headers={"Content-Type":"application/json","Accept":"application/json"},
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=120) as r:
        out=json.loads(r.read().decode("utf-8"))
    content=out["choices"][0]["message"]["content"]
    result=json.loads(content)
    return result

def main():
    try:
        models=get_json("/v1/models")
    except Exception as e:
        print(json.dumps({"status":"BLOCKED","reason":"LM_STUDIO_UNAVAILABLE","error":str(e)}))
        return 2
    ids=[str(x.get("id")) for x in models.get("data",[])]
    if not MODEL:
        print(json.dumps({"status":"BLOCKED","reason":"NO_MODEL_CONFIGURED","available_models":ids}))
        return 2
    if MODEL not in ids:
        print(json.dumps({"status":"BLOCKED","reason":"MODEL_NOT_VISIBLE","model":MODEL,"available_models":ids}))
        return 2

    evidence={
        "objective":"first verified external NZ$5",
        "economic_truth":{"verified_external_revenue_nzd":0,"settled_external_payments":0,"independent_external_buyers":0},
        "known_offer":{
            "id":"DREAMMEEZ-COSMIC-HOODIE-001",
            "price_nzd":5,
            "status":"published",
            "checkout_available":True
        },
        "constraints":[
            "no self purchase",
            "no simulated revenue",
            "no fake buyers",
            "no autonomous outreach or submission",
            "no autonomous spending",
            "human gate for irreversible external actions"
        ]
    }
    try:
        decision=ask_model(evidence)
    except Exception as e:
        print(json.dumps({"status":"BLOCKED","reason":"MODEL_CALL_FAILED","error":str(e)}))
        return 2

    print(json.dumps({
        "status":"READY",
        "model":MODEL,
        "decision":decision,
        "timestamp_utc":time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime())
    }, indent=2))
    return 0

if __name__ == "__main__":
    sys.exit(main())
