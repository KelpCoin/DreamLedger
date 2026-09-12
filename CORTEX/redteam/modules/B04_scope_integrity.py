"""B04: commercial scope must match the stated problem."""
import re
from ..contracts import Finding,ModuleResult,Verdict
REBUILD=re.compile(r'\b(build|create|implement|from scratch|new project|design|architect|whole system|end[- ]to[- ]end)\b',re.I)
RESCUE=re.compile(r'\b(broken|not working|fails?|failing|error|bug|stuck|stopped|used to work|unexpected)\b',re.I)
class Module:
 MODULE_ID='B04_scope_integrity'; MODULE_VERSION='1.0.0'; DESCRIPTION='Offer scope matches buyer problem'; FAILURE_MODE='scope_mismatch'
 def run(self,p):
  x=p.get('problem_text','') or ''; k=(p.get('commercial') or {}).get('scope_kind'); fs=[]
  if not k: return ModuleResult(self.MODULE_ID,Verdict.UNKNOWN,[Finding(self.MODULE_ID,self.MODULE_VERSION,Verdict.UNKNOWN,'medium','scope_kind missing',{})])
  a,b=bool(REBUILD.search(x)),bool(RESCUE.search(x))
  if k=='rescue' and a and not b: fs.append(Finding(self.MODULE_ID,self.MODULE_VERSION,Verdict.FAIL,'high','rescue offer against rebuild-shaped problem',{}))
  elif k=='implementation' and b and not a: fs.append(Finding(self.MODULE_ID,self.MODULE_VERSION,Verdict.QUARANTINE,'medium','implementation offer against rescue-shaped problem',{}))
  elif a and b: fs.append(Finding(self.MODULE_ID,self.MODULE_VERSION,Verdict.QUARANTINE,'medium','mixed problem signals need disambiguation',{}))
  return ModuleResult(self.MODULE_ID,Verdict.FAIL if any(f.verdict==Verdict.FAIL for f in fs) else Verdict.QUARANTINE if fs else Verdict.PASS,fs)
