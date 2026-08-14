'use strict';
const BASE=(process.env.SMOKE_BASE_URL||'http://127.0.0.1:3000').replace(/\/$/,'');
const email='chat-smoke-'+Date.now()+'@example.invalid';
let cookie='';
function pickCookie(value){const raw=value||'';const m=raw.match(/dreamiez_session=([^;]+)/);return m?`dreamiez_session=${m[1]}`:'';}
async function call(path,options={}){const headers={'Content-Type':'application/json',...(options.headers||{})};if(cookie)headers.Cookie=cookie;const r=await fetch(BASE+path,{...options,headers});const set=r.headers.get('set-cookie');if(set){const next=pickCookie(set);if(next)cookie=next;}const text=await r.text();let data={};try{data=text?JSON.parse(text):{};}catch{}if(!r.ok)throw new Error(`${path} -> HTTP ${r.status}: ${text}`);return data;}
(async()=>{
  const health=await fetch(BASE+'/healthz');if(!health.ok)throw new Error('healthz failed');
  await call('/api/account/register',{method:'POST',body:JSON.stringify({name:'Chat Smoke',email,password:'SmokePass123!'})});
  const me=await call('/api/account/me');if(!me.authenticated)throw new Error('registration did not establish a session');
  const created=await call('/api/conversations',{method:'POST',body:JSON.stringify({title:'Persistence smoke'})});
  const id=created.conversation.id;
  const sent=await call('/api/conversations/'+id+'/messages',{method:'POST',body:JSON.stringify({content:'persistent smoke message'})});
  if(!sent.messages||sent.messages.length!==2)throw new Error('message pair was not persisted');
  const before=await call('/api/conversations/'+id+'/messages');
  if(!before.messages.some(m=>m.content==='persistent smoke message'))throw new Error('message missing before relogin');
  await call('/api/account/logout',{method:'POST'});cookie='';
  await call('/api/account/login',{method:'POST',body:JSON.stringify({email,password:'SmokePass123!'})});
  const after=await call('/api/conversations/'+id+'/messages');
  if(!after.messages.some(m=>m.content==='persistent smoke message'))throw new Error('message missing after relogin');
  const proof={status:'PASS',base_url:BASE,conversation_id:id,checked_at:new Date().toISOString(),assertions:['register','login','session','conversation persistence','message persistence','logout','relogin','history recovery']};
  console.log(JSON.stringify(proof,null,2));
  require('fs').writeFileSync(process.env.PROOF_PATH||'PROOF-PERSISTENT-CHAT.json',JSON.stringify(proof,null,2)+'\n');
})().catch(err=>{console.error('PERSISTENT CHAT SMOKE FAIL:',err.message);process.exit(1);});
