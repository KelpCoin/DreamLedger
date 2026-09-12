"""B08: identity must be server-derived."""
from ..contracts import Finding,ModuleResult,Verdict
FIELDS={'agent_name','agent_id','writer_id','writer_credential_id','role','model_family','identity'}
class Module:
 MODULE_ID='B08_identity_binding'; MODULE_VERSION='1.0.0'; DESCRIPTION='Identity binding'; FAILURE_MODE='self_asserted_identity'
 def run(self,p):
  fs=[]
  def walk(o,path='proposal'):
   if isinstance(o,dict):
    for k,v in o.items():
     if k in FIELDS and (not isinstance(v,dict) or not v.get('server_derived')): fs.append(Finding(self.MODULE_ID,self.MODULE_VERSION,Verdict.FAIL,'critical','identity field is not server-derived',{'field':path+'.'+k}))
     walk(v,path+'.'+k)
   elif isinstance(o,list):
    for i,v in enumerate(o): walk(v,f'{path}[{i}]')
  walk(p); return ModuleResult(self.MODULE_ID,Verdict.FAIL if fs else Verdict.PASS,fs)
