#!/usr/bin/env python3
import json, os, re, urllib.request

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

RULES = {
 "BUY_INTENT":[r"looking to buy",r"want to buy",r"need to buy",r"where can i buy"],
 "DEMAND":[r"looking for",r"seeking",r"need ",r"does anyone know"],
 "PRICE_GAP":[r"cheaper",r"price difference",r"too expensive",r"undervalued"],
 "SUPPLY_GAP":[r"can't find",r"out of stock",r"unavailable",r"no one sells"],
 "PAIN":[r"frustrat",r"broken",r"problem",r"doesn't work"],
 "COMPETITOR":[r"competitor",r"alternative to",r"vs\.",r"versus"],
 "TREND":[r"trend",r"growing",r"lately"],
 "QUESTION":[r"\?$"],
 "TRANSACTION":[r"paid",r"bought",r"sold",r"invoice",r"customer"],
 "FAILURE":[r"failed",r"missed run",r"zero records",r"error"]
}

def api(path, method="GET", body=None):
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(SUPABASE_URL + path, data=data, method=method, headers={
        "apikey":KEY,"Authorization":"Bearer "+KEY,"Content-Type":"application/json",
        "Prefer":"return=representation"
    })
    with urllib.request.urlopen(req, timeout=30) as r:
        raw=r.read().decode()
        return json.loads(raw) if raw else []

def classify(text):
    t=text.lower()
    hits=[]
    for kind,pats in RULES.items():
        if any(re.search(p,t) for p in pats):
            hits.append(kind)
    return hits or ["QUESTION"]

def main():
    if not SUPABASE_URL or not KEY:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")
    rows=api("/rest/v1/rpc/list_unprocessed_bronze")
    normalized=0
    promoted=0
    for row in rows:
        kinds=classify(row.get("raw_content",""))
        intent=0.9 if "BUY_INTENT" in kinds else 0.65 if "DEMAND" in kinds else 0.35
        commercial=min(1.0,0.2*len(kinds)+(0.4 if "BUY_INTENT" in kinds else 0))
        confidence=min(0.98,0.55+0.07*len(kinds))
        api("/rest/v1/rpc/normalize_signal","POST",{
            "p_observation":row,
            "p_signal_types":kinds,
            "p_buyer_intent":intent,
            "p_commercial_relevance":commercial,
            "p_confidence":confidence
        })
        normalized+=1
        if confidence >= .7 and commercial >= .4:
            promoted+=1
    print(json.dumps({"status":"PASS","normalized":normalized,"promotion_candidates":promoted},indent=2))

if __name__=="__main__":
    main()
