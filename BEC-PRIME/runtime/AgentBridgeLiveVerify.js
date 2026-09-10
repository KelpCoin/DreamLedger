'use strict';

const http = require('http');
const bridge = require('./AgentBridge');

function request(port, path, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path, method: 'GET', headers }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => { let json = null; try { json = JSON.parse(body); } catch {} resolve({ status: res.statusCode, body, json }); });
    });
    req.on('error', reject); req.end();
  });
}

async function run() {
  const configured = bridge.configured();
  if (!configured) return { schema:'BEC-AGENT-BRIDGE-LIVE-VERIFY/v4',status:'NOT_CONFIGURED',configured:false,checks:{supabase_url:Boolean(process.env.SUPABASE_URL),dreamledger_agent_bridge_token:Boolean(process.env.DREAMLEDGER_AGENT_BRIDGE_TOKEN),agent_bridge_proxy_url:Boolean(process.env.AGENT_BRIDGE_PROXY_URL)},note_write_performed:false,checked_at:new Date().toISOString() };
  const server = http.createServer((req,res) => bridge.handle(req,res));
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
  const port=server.address().port; const headers={'x-dreamledger-agent-token':process.env.DREAMLEDGER_AGENT_BRIDGE_TOKEN};
  try {
    const manifest=await request(port,'/api/agent-bridge/manifest');
    if(manifest.status!==200)throw new Error(`manifest failed: HTTP ${manifest.status}`);
    if(manifest.json?.schema_version!=='BECK-AGENT-BRIDGE-1.2')throw new Error('manifest schema mismatch');
    if(manifest.json?.external_actions!=='human_approval_required')throw new Error('approval gate mismatch');
    const state=await request(port,'/api/agent-bridge/state',headers);
    if(state.status!==200)throw new Error(`state failed: HTTP ${state.status}: ${state.body}`);
    if(state.json?.state?.status!=='OPEN')throw new Error(`RA_000001 status changed: ${state.json?.state?.status}`);
    if(Number(state.json?.state?.verified_payment_count||0)!==0)throw new Error('verified payment count is non-zero');
    if(Number(state.json?.state?.revenue_nzd||0)!==0)throw new Error('revenue is non-zero');
    const jobs=await request(port,'/api/agent-bridge/jobs?status=pending&limit=10',headers);
    if(jobs.status!==200)throw new Error(`jobs failed: HTTP ${jobs.status}: ${jobs.body}`);
    if(jobs.json?.schema_version!=='BECK-ECONOMIC-JOB-1.0')throw new Error('jobs schema mismatch');
    if(!Array.isArray(jobs.json?.jobs))throw new Error('jobs payload is not an array');
    return {schema:'BEC-AGENT-BRIDGE-LIVE-VERIFY/v4',status:'PASS',configured:true,manifest:'PASS',authenticated_state_read:'PASS',authenticated_jobs_read:'PASS',normalized_contract:'PASS',ra000001_status:state.json.state.status,verified_payment_count:Number(state.json.state.verified_payment_count||0),revenue_nzd:Number(state.json.state.revenue_nzd||0),pending_job_count:jobs.json.jobs.length,note_write_performed:false,checked_at:new Date().toISOString()};
  } catch(err) { return {schema:'BEC-AGENT-BRIDGE-LIVE-VERIFY/v4',status:'FAIL',configured:true,error:err.message||String(err),note_write_performed:false,checked_at:new Date().toISOString()}; }
  finally { await new Promise(resolve=>server.close(resolve)); }
}
module.exports={run};
