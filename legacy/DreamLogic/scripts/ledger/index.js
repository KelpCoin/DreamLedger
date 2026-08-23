const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');
const root=path.join(__dirname,'..','..');const runId=process.env.RUN_ID||`ledger-${Date.now()}`;const events=process.env.EVENTS||'';const previous=process.env.PREVIOUS_HASH||'GENESIS';
const payload={schema_version:'LEDGER-1.0',run_id:runId,previous_hash:previous,events:events.split('|').filter(Boolean),generated_at:new Date().toISOString()};payload.hash=crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
const out=path.join(root,'Proof','Ledger',`${runId}.json`);fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(payload,null,2)+'\n');console.log(JSON.stringify(payload,null,2));
