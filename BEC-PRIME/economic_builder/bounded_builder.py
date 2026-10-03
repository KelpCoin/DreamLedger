#!/usr/bin/env python3
"""Create a bounded, auditable mutation proposal from economic_outbox.

This first builder stage does not edit arbitrary application code. It only
produces a proposal artifact. A separate verifier remains the gate.
"""
import datetime as dt, hashlib, json, os, urllib.request

URL=os.environ.get("SUPABASE_URL","").rstrip("/")
KEY=os.environ.get("SUPABASE_SERVICE_ROLE_KEY","")
ALLOWED=["BEC-PRIME/data/builder-proposals/"]
MAX_BYTES=12000

def get_outbox():
    req=urllib.request.Request(URL+"/rest/v1/economic_outbox?select=*&status=eq.PENDING&order=created_at.asc&limit=5",
      headers={"apikey":KEY,"Authorization":"Bearer "+KEY})
    with urllib.request.urlopen(req,timeout=30) as r:
        return json.loads(r.read().decode() or "[]")

def main():
    if not URL or not KEY: raise RuntimeError("missing Supabase worker secrets")
    rows=get_outbox()
    proposals=[]
    for row in rows:
        payload=row.get("payload") or {}
        proposals.append({
          "proposal_id":"BP-"+hashlib.sha256(json.dumps(row,sort_keys=True).encode()).hexdigest()[:16],
          "created_at":dt.datetime.now(dt.timezone.utc).isoformat(),
          "source_outbox_id":row.get("id"),
          "objective":"one surgical improvement dimension only",
          "failure_or_trigger":payload,
          "allowed_paths":ALLOWED,
          "max_proposed_bytes":MAX_BYTES,
          "authority":"PROPOSE_ONLY",
          "requires_clean_verification":True,
          "requires_human_merge":True,
          "external_action":"BLOCKED"
        })
    print(json.dumps({"schema":"dreamledger/bounded-builder/v1","count":len(proposals),"proposals":proposals},indent=2))

if __name__=="__main__":
    main()
