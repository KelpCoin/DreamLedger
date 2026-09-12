"""B01: claims require evidence."""
from ..contracts import Finding,ModuleResult,Verdict
class Module:
 MODULE_ID='B01_evidence_grounding'; MODULE_VERSION='1.0.0'; DESCRIPTION='Claims require evidence'; FAILURE_MODE='unsupported_claim'
 def run(self,p):
  fs=[]
  for i,c in enumerate(p.get('claims',[]) or []):
   if not isinstance(c,dict) or not c.get('evidence'):
    fs.append(Finding(self.MODULE_ID,self.MODULE_VERSION,Verdict.FAIL,'critical',f'claim {i} has no evidence',{'index':i}))
  return ModuleResult(self.MODULE_ID,Verdict.FAIL if fs else Verdict.PASS,fs)
