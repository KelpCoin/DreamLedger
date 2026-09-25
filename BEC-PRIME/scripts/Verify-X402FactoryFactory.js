'use strict';
const fs=require('fs'),path=require('path'); const ROOT=path.join(__dirname,'..'); const D=path.join(ROOT,'data','x402-factory');
function fail(x){throw Error(x)}
for(const f of ['endpoint-specs.json','mcp-manifest.json','FACTORY-FACTORY-REPORT.json'])if(!fs.existsSync(path.join(D,f)))fail('missing '+f);
const s=JSON.parse(fs.readFileSync(path.join(D,'endpoint-specs.json'))),m=JSON.parse(fs.readFileSync(path.join(D,'mcp-manifest.json'))),r=JSON.parse(fs.readFileSync(path.join(D,'FACTORY-FACTORY-REPORT.json')));
if(!Array.isArray(s.endpoints)||!s.endpoints.length)fail('no endpoints'); if(m.tools.length!==s.endpoints.length)fail('manifest mismatch'); if(r.endpoint_count!==s.endpoints.length)fail('report mismatch');
const ids=new Set(); for(const e of s.endpoints){if(ids.has(e.endpoint_id))fail('duplicate');ids.add(e.endpoint_id);if(!['0.10','0.05','0.02'].includes(e.price_usdc))fail('price');if(e.x402.status!=='SPEC_READY_NOT_LIVE')fail('live gate');if(e.x402.payTo!=='CONFIGURE_BEFORE_LIVE')fail('payTo gate');if(e.x402.network!=='CONFIGURE_BEFORE_LIVE')fail('network gate');}
if(m.status!=='DISCOVERY_MANIFEST_READY_NOT_LIVE')fail('manifest status'); console.log(JSON.stringify({status:'PASS',endpoint_count:s.endpoints.length,manifest_tools:m.tools.length,production_status:r.production_status},null,2));
