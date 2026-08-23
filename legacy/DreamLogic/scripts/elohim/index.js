const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');
const root=path.join(__dirname,'..','..');const runId=process.env.RUN_ID||`elohim-${Date.now()}`;const source=process.env.GAUNTLET_PROOF||'';
const input=source&&fs.existsSync(source)?fs.readFileSync(source,'utf8'):'';
const result={schema_version:'ELOHIM-1.0',run_id:runId,source:source||null,source_sha256:input?crypto.createHash('sha256').update(input).digest('hex'):null,provenance:{generated_at:new Date().toISOString(),authority:'CI'},status:input?'REFINED':'WAITING_FOR_GAUNTLET_PROOF'};
result.sha256=crypto.createHash('sha256').update(JSON.stringify(result)).digest('hex');const out=path.join(root,'Proof','Elohim',`${runId}.json`);fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
process.exitCode=input?0:1;
