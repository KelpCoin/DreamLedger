"""B12: proposal fields must not contradict one another."""
from ..contracts import Finding,ModuleResult,Verdict
class Module:
 MODULE_ID='B12_contradiction'; MODULE_VERSION='1.0.0'; DESCRIPTION='Internal contradiction detection'; FAILURE_MODE='internal_conflict'
 def run(self,p):
  fs=[]; c=p.get('commercial') or {}
  if p.get('price_nzd') is not None and c.get('price_nzd') is not None and p['price_nzd']!=c['price_nzd']: fs.append(Finding(self.MODULE_ID,self.MODULE_VERSION,Verdict.FAIL,'high','top-level and commercial prices differ',{}))
  if p.get('scope_kind') and c.get('scope_kind') and p['scope_kind']!=c['scope_kind']: fs.append(Finding(self.MODULE_ID,self.MODULE_VERSION,Verdict.FAIL,'high','top-level and commercial scope differ',{}))
  if p.get('last_buyer_activity') and p.get('stale_confirmed') is True: fs.append(Finding(self.MODULE_ID,self.MODULE_VERSION,Verdict.FAIL,'high','fresh activity marked stale',{}))
  b=p.get('buyer') or {}
  if b.get('unverified') is True and b.get('evidence'): fs.append(Finding(self.MODULE_ID,self.MODULE_VERSION,Verdict.QUARANTINE,'medium','buyer is both unverified and evidenced',{}))
  return ModuleResult(self.MODULE_ID,Verdict.FAIL if any(f.verdict==Verdict.FAIL for f in fs) else Verdict.QUARANTINE if fs else Verdict.PASS,fs)
