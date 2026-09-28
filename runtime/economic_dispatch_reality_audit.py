#!/usr/bin/env python3
"""
Economic dispatch reality audit.

Purpose:
Detect packets marked DISPATCHED whose packet-level authorization does not
actually permit an external effect. This separates orchestration state from
real authorization state before treating a dispatch as a live economic path.

This script is read-only. It never mutates economic, authorization, revenue,
or fulfillment state.
"""
import json
import os
import sys
from urllib.parse import quote
from urllib.request import Request, urlopen

SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
SERVICE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

SQL = """
select
  packet_id,
  opportunity_id,
  action_id,
  job_id,
  status,
  authorization_verdict,
  exact_action->>'external_action_allowed' as external_action_allowed,
  exact_action->>'requires_human_approval' as requires_human_approval,
  exact_action->>'fulfillment_class_id' as fulfillment_class_id,
  exact_action->>'source_ref' as source_ref
from public.economic_execution_packets
where status = 'DISPATCHED'
order by updated_at desc;
"""

def query(sql):
    url = SUPABASE_URL + "/rest/v1/rpc/execute_sql"
    body = json.dumps({"query": sql}).encode()
    req = Request(
        url,
        data=body,
        headers={
            "apikey": SERVICE_KEY,
            "Authorization": "Bearer " + SERVICE_KEY,
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urlopen(req, timeout=30) as response:
        return json.loads(response.read().decode())

def classify(row):
    external = row.get("external_action_allowed")
    verdict = row.get("authorization_verdict")
    if external == "true" and verdict == "allow":
        return "EXTERNALLY_AUTHORIZED"
    if external == "false":
        return "DISPATCHED_BUT_BLOCKED"
    return "DISPATCHED_AUTHORIZATION_UNRESOLVED"

def main():
    result = query(SQL)
    rows = result if isinstance(result, list) else result.get("result", result.get("data", []))
    counts = {
        "EXTERNALLY_AUTHORIZED": 0,
        "DISPATCHED_BUT_BLOCKED": 0,
        "DISPATCHED_AUTHORIZATION_UNRESOLVED": 0,
    }
    classified = []
    for row in rows:
        state = classify(row)
        counts[state] += 1
        item = dict(row)
        item["dispatch_reality"] = state
        classified.append(item)

    proof = {
        "schema": "dreamledger/economic-dispatch-reality-audit/v1",
        "read_only": True,
        "economic_truth_mutation": False,
        "rows_examined": len(classified),
        "counts": counts,
        "rows": classified,
    }
    print(json.dumps(proof, indent=2, sort_keys=True))

    if counts["EXTERNALLY_AUTHORIZED"] == 0:
        print(
            "LIVE_EXTERNAL_DISPATCH_COUNT=0",
            file=sys.stderr,
        )
        return 2

    return 0

if __name__ == "__main__":
    raise SystemExit(main())
