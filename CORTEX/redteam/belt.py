"""Canonical B01-B12 adversarial belt."""
from __future__ import annotations
import hashlib,json,time
from typing import Iterable
from .contracts import BeltResult,ModuleResult,Verdict
from .modules import REGISTRY,MODULE_ORDER
BELT_VERSION='redteam-belt-1.0.0'
def _hash(p): return hashlib.sha256(json.dumps(p,sort_keys=True,separators=(',',':'),ensure_ascii=True).encode()).hexdigest()
def run_belt(proposal:dict, registry=None, fail_fast_on_critical=True)->BeltResult:
 registry=registry or REGISTRY; results=[]; critical=[]; penalty=0; halted=None; started=time.time()
 for mid in MODULE_ORDER:
  m=registry[mid]; r=m.run(proposal); results.append(r)
  for f in r.findings:
   if f.severity=='critical': critical.append({'module_id':f.module_id,'message':f.message,'evidence':f.evidence})
   penalty += 10 if f.verdict==Verdict.FAIL else 5 if f.verdict==Verdict.QUARANTINE else 3 if f.verdict==Verdict.UNKNOWN else 0
  if critical and fail_fast_on_critical: halted=mid; break
 verdict=Verdict.FAIL if critical or any(r.verdict==Verdict.FAIL for r in results) else Verdict.QUARANTINE if any(r.verdict in (Verdict.QUARANTINE,Verdict.UNKNOWN) for r in results) else Verdict.PASS
 return BeltResult(BELT_VERSION,verdict,results,critical,penalty)
