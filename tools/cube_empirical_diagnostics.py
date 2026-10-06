#!/usr/bin/env python3
"""CUBE empirical diagnostics. Never manufactures observations."""
from __future__ import annotations
import json, math, os, sys
from collections import defaultdict

TRACE = os.environ.get("CUBE_TRACE_PATH", "runtime/777/cube-swarm-traces.jsonl")
TOPO = os.environ.get("CUBE_TOPOLOGY_PATH", "runtime/777/cube-authorization-topology.json")

def read_jsonl(path):
    if not os.path.exists(path): return []
    rows=[]
    with open(path, encoding="utf-8") as f:
        for line in f:
            if line.strip(): rows.append(json.loads(line))
    return rows

def beta_from_efficiency(rows):
    # R=N_eff/N. Here N_eff is inferred only from observed successes per task.
    # A beta estimate needs multiple N values; one point is insufficient.
    grouped=defaultdict(lambda: [0,0])
    for r in rows:
        n=int(r.get("cell_count", 0) or 0)
        if n>0:
            grouped[n][0]+=1
            grouped[n][1]+=bool(r.get("success", False))
    points=[]
    for n,(m,s) in sorted(grouped.items()):
        if m:
            points.append({"N":n,"R":s/m})
    if len(points)<3:
        return {"status":"NO_DATA","reason":"NEED_AT_LEAST_3_DISTINCT_CELL_COUNTS","points":points}
    # Fit beta by grid search to R(N)=1/(1+c(N-1)N^-beta).
    best=None
    for i in range(1,401):
        beta=i/100
        cs=[]
        for p in points:
            n,r=p["N"],p["R"]
            if 0<r<1 and n>1:
                cs.append((1/r-1)*n**beta/(n-1))
        if not cs: continue
        c=sum(cs)/len(cs)
        err=sum((p["R"]-1/(1+c*(p["N"]-1)*p["N"]**(-beta)))**2 for p in points)
        if best is None or err<best[0]: best=(err,beta,c)
    return {"status":"OBSERVED","beta":best[1],"c":best[2],"points":points} if best else {"status":"NO_DATA","reason":"INSUFFICIENT_NONTRIVIAL_RATES","points":points}

def auth_check():
    if not os.path.exists(TOPO):
        return {"status":"NO_DATA","reason":"AUTHORIZATION_TOPOLOGY_MISSING","required":TOPO}
    topo=json.load(open(TOPO,encoding="utf-8"))
    depth=int(topo.get("max_depth",0))
    mode=topo.get("topology","unknown")
    return {"status":"OBSERVED","max_depth":depth,"topology":mode,
            "gate":"PASS" if depth<=3 else "NO_GO","rule":"depth<=3; peer for depth 2-3; centralized for depth 1"}

def main():
    rows=read_jsonl(TRACE)
    return {
      "beta_measurement": beta_from_efficiency(rows),
      "masdrift_authorization_check": auth_check(),
      "aggregator_pilot": {
        "status":"NO_DATA",
        "reason":"NO_REAL_CUBE_EXECUTION_TRACE_OR_AGGREGATION_RUN",
        "rule":"aggregator may synthesize observed partial results only; it cannot create evidence"
      },
      "scale_gate":"NO_GO",
      "verified_external_revenue_nzd":0.0
    }

print(json.dumps(main(), indent=2))
