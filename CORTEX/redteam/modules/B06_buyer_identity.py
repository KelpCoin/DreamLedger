"""B06: buyer must be specific and contactable."""
import re
from ..contracts import Finding,ModuleResult,Verdict
VAGUE=re.compile(r'\b(someone|somebody|a user|the user|users|people|a business|a company|many|anyone|whoever|some|various|several)\b',re.I)
class Module:
 MODULE_ID='B06_buyer_identity'; MODULE_VERSION='1.0.0'; DESCRIPTION='Specific buyer identity'; FAILURE_MODE='vague_buyer'
 def run(self,p):
  b=p.get('buyer') or {}; h=(b.get('handle') or '').strip(); ch=(b.get('channel') or '').strip(); fs=[]
  if not h or VAGUE.search(h): fs.append(Finding(self.MODULE_ID,self.MODULE_VERSION,Verdict.FAIL,'high','buyer identity is missing or vague',{'handle':h}))
  if not ch: fs.append(Finding(self.MODULE_ID,self.MODULE_VERSION,Verdict.QUARANTINE,'medium','buyer channel missing',{}))
  return ModuleResult(self.MODULE_ID,Verdict.FAIL if any(f.verdict==Verdict.FAIL for f in fs) else Verdict.QUARANTINE if fs else Verdict.PASS,fs)
