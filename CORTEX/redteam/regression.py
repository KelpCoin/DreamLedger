"""Regression corpus for known-bad proposals.

A failing module becomes a durable case. JSON is canonicalized before hashing,
so filenames are stable across Python processes and machines.
"""
from __future__ import annotations
import hashlib
import json
from pathlib import Path
from .belt_extension import run_extension_belt

CORPUS = Path(__file__).resolve().parent / "corpus"

def _digest(value: object) -> str:
    raw=json.dumps(value,sort_keys=True,separators=(",",":"),ensure_ascii=True).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()[:20]

def add_case(proposal: dict, module_id: str, finding_msg: str) -> Path:
    CORPUS.mkdir(parents=True,exist_ok=True)
    case={"proposal":proposal,"expected_module":module_id,"expected_finding":finding_msg,"schema":"dreamledger/redteam-regression/v1"}
    path=CORPUS/f"{module_id}_{_digest(proposal)}.json"
    path.write_text(json.dumps(case,indent=2,sort_keys=True)+"\n",encoding="utf-8")
    return path

def run_regression() -> dict:
    results={"total":0,"passed":0,"failed":[],"ok":True}
    if not CORPUS.exists(): return results
    for p in sorted(CORPUS.glob("*.json")):
        case=json.loads(p.read_text(encoding="utf-8"))
        results["total"]+=1
        belt=run_extension_belt(case["proposal"])
        found=any(m.module_id==case["expected_module"] and m.verdict.value!="PASS" for m in belt.modules)
        if found: results["passed"]+=1
        else: results["failed"].append(p.name)
    results["ok"]=not results["failed"]
    return results

if __name__=="__main__":
    print(json.dumps(run_regression(),indent=2,sort_keys=True))
