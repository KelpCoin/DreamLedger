"""B07: external actions require explicit approval."""
from ..contracts import Finding,ModuleResult,Verdict
EXTERNAL={'send_message','send_email','publish','charge_card','refund','create_order','payout'}
class Module:
 MODULE_ID='B07_approval_boundary'; MODULE_VERSION='1.0.0'; DESCRIPTION='Approval gate'; FAILURE_MODE='approval_bypass'
 def run(self,p):
  fs=[]
  for a in p.get('proposed_actions',[]) or []:
   if not isinstance(a,dict) or a.get('type') not in EXTERNAL: continue
   if not a.get('approval_id') or a.get('approval_id') in ('self','auto','model'): fs.append(Finding(self.MODULE_ID,self.MODULE_VERSION,Verdict.FAIL,'critical','external action lacks independent approval',{'action':a.get('type')}))
  return ModuleResult(self.MODULE_ID,Verdict.FAIL if fs else Verdict.PASS,fs)
