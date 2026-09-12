"""B03: buyer-originated signals expire after 14 days."""
from datetime import datetime,timezone
from ..contracts import Finding,ModuleResult,Verdict
class Module:
 MODULE_ID='B03_freshness'; MODULE_VERSION='1.0.0'; DESCRIPTION='Buyer signal freshness'; FAILURE_MODE='stale_signal'
 def run(self,p):
  raw=p.get('last_buyer_activity');
  if not raw:return ModuleResult(self.MODULE_ID,Verdict.FAIL,[Finding(self.MODULE_ID,self.MODULE_VERSION,Verdict.FAIL,'high','last_buyer_activity missing',{})])
  try: age=(datetime.now(timezone.utc)-datetime.fromisoformat(str(raw).replace('Z','+00:00'))).days
  except Exception:return ModuleResult(self.MODULE_ID,Verdict.FAIL,[Finding(self.MODULE_ID,self.MODULE_VERSION,Verdict.FAIL,'high','activity timestamp invalid',{'value':raw})])
  if age>14:return ModuleResult(self.MODULE_ID,Verdict.FAIL,[Finding(self.MODULE_ID,self.MODULE_VERSION,Verdict.FAIL,'high','buyer signal older than 14 days',{'age_days':age})])
  return ModuleResult(self.MODULE_ID,Verdict.PASS,[])
