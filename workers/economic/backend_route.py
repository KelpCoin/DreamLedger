#!/usr/bin/env python3
"""Choose ONE cloud commerce performer. Fail-closed migration policy.

Never auto-fail over across independent databases without verified shared
event/fulfillment state, and never silently invoke a suspended legacy provider.
These flags are operational approvals, not independent proof of readiness.
"""
import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path

SCHEMA="BECK/COMMERCE-BACKEND-ROUTE/v1"
NEON_GATES=(
 "BECK_NEON_COMMERCE_ENABLED",
 "BECK_NEON_SOURCE_RECONCILED",
 "BECK_NEON_DELIVERY_ATTESTED",
 "BECK_NEON_CUTOVER_APPROVED",
)
SUPABASE_GATES=(
 "BECK_SUPABASE_FALLBACK_APPROVED",
 "BECK_SUPABASE_RECOVERY_VERIFIED",
 "BECK_SUPABASE_SOURCE_RECONCILED",
 "BECK_SUPABASE_SINGLE_WRITER_FENCE_VERIFIED",
)

def choose(env):
    preferred=(env.get("BECK_COMMERCE_PRIMARY") or "neon").strip().lower()
    if preferred not in ("neon","supabase"):
        return "HOLD","UNKNOWN_PRIMARY_REJECTED",preferred
    needed=NEON_GATES if preferred=="neon" else SUPABASE_GATES
    if any(env.get(g)!="1" for g in needed):
        return "HOLD", "PRIMARY_CUTOVER_EVIDENCE_UNATTESTED" if preferred=="neon" else "FALLBACK_EVIDENCE_UNATTESTED",preferred
    return preferred.upper(),"OPERATOR_GATES_SET_NOT_INDEPENDENT_ATTESTATION",preferred

def proof(env):
    result,reason,preferred=choose(env)
    p={
      "schema":SCHEMA,
      "checked_at_utc":dt.datetime.now(dt.timezone.utc).isoformat(),
      "preferred_backend":preferred,
      "selected_backend":result,
      "reason":reason,
      "automatic_cross_database_failover":False,
      "supabase_is_not_automatically_primary":True,
      "neon_intended_primary":True,
      "live_source_database_reconciliation_independently_verified":False,
      "payment_receipts_independently_verified":False,
      "production_cutover_approved_by_this_code":False,
      "production_revenue_claimed_nzd":None,
      "github_run_id":env.get("GITHUB_RUN_ID","local"),
    }
    payload=json.dumps(p,sort_keys=True,separators=(",",":"),ensure_ascii=True).encode()
    p["sha256"]=hashlib.sha256(payload).hexdigest()
    return p

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--out",default="proof/commerce/backend-route.json")
    ap.add_argument("--github-output",default="")
    a=ap.parse_args()
    p=proof(os.environ)
    path=Path(a.out)
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(p,sort_keys=True,indent=2)+"\n",encoding="utf-8")
    if a.github_output:
        with open(a.github_output,"a",encoding="utf-8") as f:
            f.write("backend="+p["selected_backend"]+"\n")
    print(json.dumps({"backend":p["selected_backend"],"reason":p["reason"],
       "sha256":p["sha256"],"artifact":str(path)},sort_keys=True))

if __name__=="__main__":
    main()
