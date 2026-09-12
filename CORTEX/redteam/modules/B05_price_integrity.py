"""B05: price must match the declared commercial band."""
from ..contracts import Finding,ModuleResult,Verdict
BANDS={'rescue':(99,99),'implementation':(299,999),'audit':(49,199)}
class Module:
 MODULE_ID='B05_price_integrity'; MODULE_VERSION='1.0.0'; DESCRIPTION='Price integrity'; FAILURE_MODE='price_out_of_band'
 def run(self,p):
  c=p.get('commercial') or {}; k=c.get('scope_kind'); price=c.get('price_nzd'); cur=(c.get('currency') or 'NZD').upper(); fs=[]
  if cur!='NZD': fs.append(Finding(self.MODULE_ID,self.MODULE_VERSION,Verdict.FAIL,'high','unsupported currency',{'currency':cur}))
  if k not in BANDS: fs.append(Finding(self.MODULE_ID,self.MODULE_VERSION,Verdict.UNKNOWN,'medium','no declared price band',{'scope_kind':k}))
  elif price is None or not isinstance(price,(int,float)) or not BANDS[k][0]<=price<=BANDS[k][1]: fs.append(Finding(self.MODULE_ID,self.MODULE_VERSION,Verdict.FAIL,'high','price outside band',{'price':price,'band':BANDS[k]}))
  elif price not in BANDS[k]: fs.append(Finding(self.MODULE_ID,self.MODULE_VERSION,Verdict.QUARANTINE,'low','price is not a declared endpoint',{'price':price,'band':BANDS[k]}))
  v=Verdict.FAIL if any(f.verdict==Verdict.FAIL for f in fs) else Verdict.UNKNOWN if any(f.verdict==Verdict.UNKNOWN for f in fs) else Verdict.QUARANTINE if fs else Verdict.PASS
  return ModuleResult(self.MODULE_ID,v,fs)
