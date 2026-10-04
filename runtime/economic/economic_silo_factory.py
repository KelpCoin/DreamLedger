from __future__ import annotations
import argparse, hashlib, json
from itertools import product
from pathlib import Path
from typing import Any

SCHEMA="DREAMLEDGER/ECONOMIC-SILO-FACTORY/v1"
MAX_CELLS=10000
DEMAND_SOURCES=("reddit","github","public_procurement","vendor_search")
INPUTS=("documents","structured_data","evidence_bundle","system_metadata")
OUTPUTS=("comparison","evidence_report","preflight_report","readiness_report")
ACCESS_MODELS=("PUBLIC_MVP","PRIVATE_MVP","KEY_GATED")
FULFILLMENT_MODES=("existing_quote_intake","existing_quote_fulfillment","economic_fulfillment_worker","existing_verification")

def canonical_json(v:Any)->str:
    return json.dumps(v,sort_keys=True,separators=(",",":"),ensure_ascii=True)
def sha256_json(v:Any)->str:
    return hashlib.sha256(canonical_json(v).encode("utf-8")).hexdigest()
def load_json(p:Path)->dict:
    return json.loads(p.read_text(encoding="utf-8"))
def caps(raw):
    out=[]
    for x in raw:
        if isinstance(x,dict): out.append({"capability_id":str(x.get("capability_id") or x.get("id")),"input_type":str(x.get("input_type") or x.get("type") or "unknown"),"description":str(x.get("description") or x.get("name") or "")})
        else: out.append({"capability_id":str(x[0]),"input_type":str(x[1]),"description":str(x[2])})
    return sorted([x for x in out if x["capability_id"]!="None"],key=lambda x:x["capability_id"])
def offers(raw):
    out=[]
    for x in raw:
        if isinstance(x,dict): out.append({"offer_id":str(x.get("offer_id") or x.get("id")),"status":str(x.get("status","UNOBSERVED")),"checkout_available":bool(x.get("checkout_available",False)),"silo":x.get("silo")})
        else: out.append({"offer_id":str(x[0]),"status":str(x[1]),"checkout_available":bool(x[2]),"silo":x[4] if len(x)>4 else None})
    return sorted([x for x in out if x["offer_id"]!="None"],key=lambda x:x["offer_id"])
def demand_refs(src):
    r={}
    for x in src.get("observed_demand_signals",[]):
        if isinstance(x,dict): sid=x.get("demand_signal_id") or x.get("id"); ds=x.get("source") or x.get("demand_source")
        else: sid=x[0] if x else None; ds=x[1] if len(x)>1 else None
        if sid and ds: r.setdefault(str(ds).lower(),[]).append(str(sid))
    return r
def compatible(cid,oid):
    return {"BEC-PRIME-ARCHITECTURE":"OFFER-BEC-PRIME-ARCHITECTURE-AUDIT-002","BEC-PRIME-AGENT-COMMERCE":"OFFER-BEC-PRIME-AGENT-READINESS-001","BEC-PRIME-READINESS-AUDIT":"OFFER-BEC-PRIME-AGENT-READINESS-001"}.get(cid)==oid
def classify(cap,off,signal,fulfill,src):
    if off["status"]!="APPROVED" or not off["checkout_available"]: return "BLOCKED","APPROVED_CHECKOUT_OFFER_UNOBSERVED",False
    if not compatible(cap["capability_id"],off["offer_id"]): return "BLOCKED","OFFER_CAPABILITY_MATCH_UNOBSERVED",False
    f=src.get("existing_fulfillment_substrate",{})
    ok={"existing_quote_intake":"quote_intake","existing_quote_fulfillment":"quote_fulfillment","economic_fulfillment_worker":"economic_fulfillment_worker","existing_verification":"evidence_hashing"}
    if not f.get(ok[fulfill],False): return "BLOCKED","FULFILLMENT_PATH_UNOBSERVED",False
    if not src.get("offer_fulfillment_map",{}).get(off["offer_id"],{}).get(fulfill,False): return "BLOCKED","OFFER_FULFILLMENT_MAPPING_UNOBSERVED",False
    if not src.get("payment_path_observed",False): return "BLOCKED","PAYMENT_PATH_UNOBSERVED",False
    if not src.get("evidence_path_observed",bool(f.get("evidence_hashing"))): return "BLOCKED","EVIDENCE_PATH_UNOBSERVED",False
    if not src.get("commercial_boundary_observed",True): return "BLOCKED","COMMERCIAL_BOUNDARY_UNOBSERVED",False
    return "READY_FOR_PAYMENT","NONE",False
def cell(cap,off,ds,sig,inp,out,access,fulfill,src):
    raw="|".join([cap["capability_id"],off["offer_id"],ds,str(sig),inp,out,access,fulfill])
    cid="CELL-"+hashlib.sha256(raw.encode()).hexdigest()[:20].upper()
    state,blocker,rep=classify(cap,off,sig,fulfill,src)
    return {"CELL_ID":cid,"CAPABILITY_ID":cap["capability_id"],"DEMAND_SOURCE":ds,"DEMAND_SIGNAL":sig,"INPUT":inp,"OUTPUT":out,"OFFER":off["offer_id"],"FULFILLMENT_PATH":fulfill,"ACCESS_MODEL":access,"PAYMENT_PATH":"EXISTING_STRIPE" if src.get("payment_path_observed") else "UNOBSERVED","AUTHORITY_REQUIRED":"NONE_OBSERVED_FOR_BOUNDED_REPORT","DELIVERY_MODE":"AUTOMATED_DELIVERY_ALLOWED","EVIDENCE_PATH":"SHA256_ARTIFACT_UNVERIFIED" if src.get("evidence_path_observed",bool(src.get("existing_fulfillment_substrate",{}).get("evidence_hashing"))) else "UNOBSERVED","PUBLICATION_STATE":"CANDIDATE","ECONOMIC_STATE":state,"BLOCKER":blocker,"FAILURE_MODE":"BLOCKED_FAIL_CLOSED" if blocker!="NONE" else "RECOVERABLE_RETRY_OR_EXTERNAL_EVENT","HUMAN_MINUTES":0,"REPLICATION_ELIGIBLE":rep}
def generate_cells(src,limit=MAX_CELLS):
    dsref=demand_refs(src); out=[]; seen=set()
    for ca,of,ds,inp,ot,am,fm in product(caps(src.get("observed_capabilities",[])),offers(src.get("observed_existing_offers",[])),DEMAND_SOURCES,INPUTS,OUTPUTS,ACCESS_MODELS,FULFILLMENT_MODES):
        for sig in dsref.get(ds,[None]):
            c=cell(ca,of,ds,sig,inp,ot,am,fm,src)
            if c["CELL_ID"] not in seen: seen.add(c["CELL_ID"]); out.append(c)
            if len(out)>=limit:return out
    return out
def summarize(cells):
    r={}
    for c in cells:r[c["ECONOMIC_STATE"]]=r.get(c["ECONOMIC_STATE"],0)+1
    return dict(sorted(r.items()))
def write_outputs(source_path,out_dir,limit):
    src=load_json(source_path); cells=generate_cells(src,limit); summary=summarize(cells); blockers={}
    for c in cells:
        if c["BLOCKER"]!="NONE": blockers[c["BLOCKER"]]=blockers.get(c["BLOCKER"],0)+1
    catalog={"schema":SCHEMA,"generated_at_utc":src.get("generated_at_utc","UNOBSERVED"),"source_artifact":source_path.as_posix(),"source_commit":src.get("base_commit"),"limit":limit,"candidate_count":len(cells),"classification_counts":summary,"truth_boundary":src.get("truth_boundary",{}),"cells":cells}
    promotion={"schema":SCHEMA+"/promotion","candidate_count":len(cells),"ready_for_payment":[c["CELL_ID"] for c in cells if c["ECONOMIC_STATE"]=="READY_FOR_PAYMENT"],"public_mvp_candidates":[c["CELL_ID"] for c in cells if c["ACCESS_MODEL"]=="PUBLIC_MVP" and c["ECONOMIC_STATE"]!="KILL"],"key_gated_candidates":[c["CELL_ID"] for c in cells if c["ACCESS_MODEL"]=="KEY_GATED" and c["ECONOMIC_STATE"]!="KILL"]}
    br={"schema":SCHEMA+"/blockers","candidate_count":len(cells),"blocker_counts":dict(sorted(blockers.items())),"unobservable":src.get("unobservable",[]),"rule":"Undefined or unobservable authoritative state is never treated as zero."}
    proof={"schema":SCHEMA+"/proof","source_commit":src.get("base_commit"),"candidate_count":len(cells),"classification_counts":summary,"catalog_sha256":sha256_json(catalog),"truth_boundary":src.get("truth_boundary",{}),"side_effects":[]}
    out_dir.mkdir(parents=True,exist_ok=True)
    payloads={"ECONOMIC-SILO-CATALOG-2026-10-04.json":catalog,"ECONOMIC-SILO-BLOCKERS-2026-10-04.json":br,"ECONOMIC-SILO-PROMOTION-2026-10-04.json":promotion,"ECONOMIC-SILO-FACTORY-PROOF-2026-10-04.json":proof}
    for n,p in payloads.items():(out_dir/n).write_text(json.dumps(p,indent=2,sort_keys=True,ensure_ascii=True)+"\n",encoding="utf-8")
    return {"candidate_count":len(cells),"classification_counts":summary,"paths":{k:str(out_dir/k) for k in payloads}}
def main():
    p=argparse.ArgumentParser();p.add_argument("--source",required=True,type=Path);p.add_argument("--out-dir",default=Path("runtime/economic"),type=Path);p.add_argument("--limit",type=int,default=MAX_CELLS);a=p.parse_args()
    if not 1<=a.limit<=MAX_CELLS: raise SystemExit("limit must be between 1 and 10000")
    print(json.dumps(write_outputs(a.source,a.out_dir,a.limit),sort_keys=True))
if __name__=="__main__":main()
