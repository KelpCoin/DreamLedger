import os, re, json, hashlib, urllib.request
from datetime import datetime, timezone

BASE=os.environ["SUPABASE_URL"].rstrip("/")
KEY=os.environ["SUPABASE_SERVICE_ROLE_KEY"]
UA="BrownEye-CUBE-MechanismResolver/1.0"

def req(method,path,payload=None,params=""):
    url=BASE+"/rest/v1/"+path+("?" + params if params else "")
    headers={"apikey":KEY,"Authorization":"Bearer "+KEY,"Content-Type":"application/json","User-Agent":UA}
    data=None if payload is None else json.dumps(payload).encode()
    r=urllib.request.Request(url,data=data,method=method,headers=headers)
    with urllib.request.urlopen(r,timeout=60) as x:
        raw=x.read().decode()
        return json.loads(raw) if raw else None

def words(s):
    return set(re.findall(r"[a-z0-9]{3,}",(s or "").lower()))

def infer(signal):
    p=signal.get("payload") or {}
    title=str(p.get("title") or "")
    body=str(p.get("body") or "")
    text=(title+" "+body).lower()
    buyer="consumer"
    if any(x in text for x in ["business","company","client","agency","team","enterprise","saas","retailer"]): buyer="smb"
    if any(x in text for x in ["developer","api","integration","code","github"]): buyer="developer"
    if any(x in text for x in ["professional","consultant","expert","lawyer","accountant"]): buyer="professional"
    if any(x in text for x in ["price","cost","cheapest","deal","discount","how much"]): problem="pricing"
    elif any(x in text for x in ["buy","purchase","order","where can i get","source","find me"]): problem="sourcing"
    elif any(x in text for x in ["verify","legit","real","scam","trust","proof"]): problem="verification"
    elif any(x in text for x in ["compare","versus","vs","which one","best"]): problem="comparison"
    elif any(x in text for x in ["alert","notify","monitor","watch"]): problem="monitoring"
    elif any(x in text for x in ["research","analysis","report","data"]): problem="research"
    elif any(x in text for x in ["save","saving","waste","expensive"]): problem="savings"
    else: problem="information"
    intent="VERIFIED" if signal.get("payment_intent_status")=="VERIFIED" else "UNVERIFIED"
    return buyer,problem,intent,title[:240]

def score(silo, buyer, problem, signal):
    i=silo.get("identity") or {}
    c=silo.get("commerce") or {}
    d=silo.get("distribution") or {}
    text=" ".join(str(i.get(k,"")) for k in ["lane_family","lane_definition","domain_label","portfolio_role","public_route"])
    text+=" "+str(c.get("fulfillment",""))+" "+str(c.get("monetization_service_name",""))
    w=words(text)
    p=words(problem)
    base=len(w & p)*2
    if buyer in (i.get("buyer_segments") or []): base+=5
    if c.get("price_nzd"): base+=1
    if c.get("fulfillment"): base+=2
    if d.get("status")=="active": base+=1
    if i.get("commercial_readiness")=="GATED": base+=0
    return base

def mechanism_score(m, buyer, problem, signal):
    b=set(m.get("buyer_fit") or [])
    p=set(m.get("problem_fit") or [])
    s=(signal.get("payload") or {})
    text=((s.get("title") or "")+" "+(s.get("body") or "")).lower()
    score=(5 if buyer in b else 0)+(5 if problem in p else 0)
    if m.get("price_model") in ("subscription","usage","pay_per_lead") and any(x in text for x in ["monitor","alert","api","lead"]): score+=2
    if m.get("price_model") in ("fixed","outcome_based","performance") and any(x in text for x in ["buy","pay","purchase","order"]): score+=2
    return score

def main():
    now=datetime.now(timezone.utc).isoformat()
    run=req("POST","cube_radar_runs",{"status":"RUNNING","started_at":now})
    run_id=run[0]["run_id"] if isinstance(run,list) else run.get("run_id")
    try:
        signals=req("GET","demand_signals",params="select=id,silo,signal_key,observed_at,source,evidence_ref,payload,demand_evidence_status,payment_intent_status&order=observed_at.desc&limit=100")
        silos=req("GET","cube_silo_registry",params="select=silo_id,display_name,identity,community,production,distribution,commerce,measurement,active&limit=600")
        mechs=req("GET","cube_mechanisms",params="select=mechanism_id,mechanism_type,label,buyer_fit,problem_fit,price_model,payment_rails,distribution_channels,conversion_triggers,fulfillment_methods,trust_requirements,verification_methods&enabled=eq.true&limit=100")
        created=qualified=0
        for sig in signals or []:
            buyer,problem,intent,title=infer(sig)
            if sig.get("demand_evidence_status") not in ("VERIFIED","UNVERIFIED"): continue
            qualified+=1
            silo_rank=sorted(((score(s,buyer,problem,sig),s) for s in silos or []),key=lambda x:x[0],reverse=True)[:8]
            for ss,s in silo_rank[:3]:
                if ss<=0: continue
                ranked=sorted(((mechanism_score(m,buyer,problem,sig),m) for m in mechs or []),key=lambda x:x[0],reverse=True)[:3]
                for ms,m in ranked[:2]:
                    total=float(ss+ms)
                    key=hashlib.sha256((s["silo_id"]+"|"+str(sig["id"])+"|"+m["mechanism_id"]).encode()).hexdigest()
                    payload={
                      "silo_id":s["silo_id"],
                      "demand_signal_id":sig["id"],
                      "mechanism_id":m["mechanism_id"],
                      "buyer":{"segment":buyer,"status":"INFERRED"},
                      "problem":problem,
                      "demand_evidence":{"status":sig.get("demand_evidence_status"),"source":sig.get("source"),"evidence_ref":sig.get("evidence_ref"),"title":title},
                      "payment_intent_status":intent,
                      "price_nzd":None,
                      "payment_rail":(m.get("payment_rails") or ["stripe_checkout"])[0],
                      "fulfillment_method":(m.get("fulfillment_methods") or ["report"])[0],
                      "distribution_channel":(m.get("distribution_channels") or ["seo"])[0],
                      "evidence_status":sig.get("demand_evidence_status") or "UNVERIFIED",
                      "gauntlet_verdict":"PENDING",
                      "truth_verdict":"PENDING",
                      "selection_state":"CANDIDATE",
                      "test_action":{"type":"CHEAPEST_BOUNDED_TEST","price_status":"PROPOSED","external_action_allowed":False,"approval_required":True},
                      "expected_evidence":{"success":"external_response_then_settled_payment_then_fulfillment_then_independent_proof","failure":"no_response_or_no_payment"},
                      "score":total,
                      "rationale":"Deterministic fit between observed demand problem, existing silo metadata, and mechanism vocabulary. No revenue or payment claim.",
                      "context":{"silo_route":(s.get("identity") or {}).get("public_route"),"source":sig.get("source"),"buyer_segment":buyer,"problem":problem},
                      "provenance":{"resolver":"cube-mechanism-resolver-v1","run_id":run_id,"observed_at":now,"match_key":key}
                    }
                    req("POST","cube_mechanism_matches",payload,params="on_conflict=ignore")
                    created+=1
        health={"component":"cube_mechanism_resolver","status":"OK","last_ok_at":now,"last_failure_at":None,"consecutive_failures":0,"last_error_code":None,"last_error_detail":None,"recovery_action":None,"updated_at":now}
        req("POST","cube_system_health",health,params="on_conflict=component")
        req("PATCH","cube_radar_runs",{"finished_at":now,"status":"PASS","signals_ingested":len(signals or []),"signals_qualified":qualified,"matches_created":created,"errors":0,"degraded":False,"health":{"resolver":"OK"}},params="run_id=eq."+run_id)
        print(json.dumps({"status":"PASS","signals":len(signals or []),"qualified":qualified,"matches_created":created}))
    except Exception as e:
        detail=str(e)[:500]
        health={"component":"cube_mechanism_resolver","status":"DEGRADED","last_failure_at":now,"consecutive_failures":1,"last_error_code":"RESOLVER_ERROR","last_error_detail":detail,"recovery_action":"retry_next_cycle_and_preserve_prior_evidence","updated_at":now}
        req("POST","cube_system_health",health,params="on_conflict=component")
        req("PATCH","cube_radar_runs",{"finished_at":now,"status":"DEGRADED","errors":1,"degraded":True,"failure_codes":["RESOLVER_ERROR"],"health":{"resolver":"DEGRADED"}},params="run_id=eq."+run_id)
        raise

if __name__=="__main__":
    main()
