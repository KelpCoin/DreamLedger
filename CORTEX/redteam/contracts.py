"""Deterministic contracts for the adversarial belt."""
from __future__ import annotations
from dataclasses import dataclass,field
from enum import Enum
from typing import Any
class Verdict(str,Enum):
 PASS='PASS'; FAIL='FAIL'; QUARANTINE='QUARANTINE'; UNKNOWN='UNKNOWN'
@dataclass(frozen=True)
class Finding:
 module_id:str; module_version:str; verdict:Verdict; severity:str; message:str; evidence:dict[str,Any]=field(default_factory=dict)
@dataclass(frozen=True)
class ModuleResult:
 module_id:str; verdict:Verdict; findings:list[Finding]=field(default_factory=list)
@dataclass(frozen=True)
class BeltResult:
 version:str; verdict:Verdict; modules:list[ModuleResult]; critical_findings:list[dict[str,Any]]; score_penalty:int
 def to_gauntlet_input(self): return {'belt_version':self.version,'verdict':self.verdict.value,'critical_findings':self.critical_findings,'score_penalty':self.score_penalty,'modules':[{'module_id':m.module_id,'verdict':m.verdict.value,'findings':[{'module_id':f.module_id,'module_version':f.module_version,'verdict':f.verdict.value,'severity':f.severity,'message':f.message,'evidence':f.evidence} for f in m.findings]} for m in self.modules]}
 def to_dict(self): return self.to_gauntlet_input()
