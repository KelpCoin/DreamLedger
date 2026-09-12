"""B02: source references must be well formed and resolved when cached."""
import re
from ..contracts import Finding,ModuleResult,Verdict
URL_RE=re.compile(r'^https?://[^\s]+$',re.I)
class Module:
 MODULE_ID='B02_source_resolvability'; MODULE_VERSION='1.0.0'; DESCRIPTION='Sources must be resolvable'; FAILURE_MODE='unresolvable_source'
 def run(self,p):
  fs=[]; cache=p.get('resolution_cache',{}) or {}
  for i,c in enumerate(p.get('claims',[]) or []):
   for s in (c.get('evidence',[]) if isinstance(c,dict) else []) or []:
    if not isinstance(s,str) or not s.strip(): fs.append(Finding(self.MODULE_ID,self.MODULE_VERSION,Verdict.FAIL,'high','empty/non-string evidence',{'index':i})); continue
    if URL_RE.match(s) and s in cache and cache[s].get('ok') is False: fs.append(Finding(self.MODULE_ID,self.MODULE_VERSION,Verdict.FAIL,'high','cached URL resolution failed',{'url':s}))
    elif URL_RE.match(s) and s not in cache: fs.append(Finding(self.MODULE_ID,self.MODULE_VERSION,Verdict.QUARANTINE,'medium','URL has no resolution record',{'url':s}))
  v=Verdict.FAIL if any(f.verdict==Verdict.FAIL for f in fs) else Verdict.QUARANTINE if fs else Verdict.PASS
  return ModuleResult(self.MODULE_ID,v,fs)
