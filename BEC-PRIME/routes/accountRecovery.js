'use strict';
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const https=require('https');
const auth=require('./auth');
const ROOT=path.join(__dirname,'..');
const DATA=process.env.DREAMIEZ_DATA_DIR||((fs.existsSync('/var/data')&&fs.statSync('/var/data').isDirectory())?'/var/data/dreamiez':path.join(ROOT,'data','dreamiez'));
const USERS=path.join(DATA,'users.json');
const ORIGIN=(process.env.PUBLIC_ORIGIN||'https://dreamledger.org').replace(/\/$/,'');
function read(){try{return JSON.parse(fs.readFileSync(USERS,'utf8'))}catch{return[]}}
function write(v){fs.mkdirSync(path.dirname(USERS),{recursive:true});const tmp=USERS+'.reset-'+process.pid+'-'+Date.now();fs.writeFileSync(tmp,JSON.stringify(v,null,2)+'\n');fs.renameSync(tmp,USERS)}
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));return true}
function body(req){return new Promise((resolve,reject)=>{let s='';req.on('data',c=>{s+=c;if(s.length>100000)req.destroy()});req.on('end',()=>{try{resolve(s?JSON.parse(s):{})}catch(e){reject(e)}});req.on('error',reject)})}
function sendEmail(to,name,token){const key=process.env.RESEND_API_KEY,from=process.env.RESEND_FROM_EMAIL;if(!key||!from)throw new Error('Password recovery email is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL in Render.');const link=ORIGIN+'/reset-password.html?token='+encodeURIComponent(token);const payload=JSON.stringify({from,to:[to],subject:'Reset your DreamLedger password',html:'<p>Hi '+String(name||'Dreamer').replace(/[&<>]/g,'')+',</p><p>Reset your DreamLedger password:</p><p><a href="'+link+'">Choose a new password</a></p><p>This link expires in 1 hour.</p>'});return new Promise((resolve,reject)=>{const r=https.request({hostname:'api.resend.com',path:'/emails',method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json','Content-Length':Buffer.byteLength(payload)}},res=>{let s='';res.on('data',c=>s+=c);res.on('end',()=>res.statusCode>=200&&res.statusCode<300?resolve():reject(new Error('Password recovery email provider rejected the request')))});r.on('error',reject);r.write(payload);r.end()})}
async function handle(req,res,url){
  if(await auth.handle(req,res,url)) return true;
  if(req.method==='POST'&&url==='/api/account/password-reset/request'){const b=await body(req),email=String(b.email||'').trim().toLowerCase(),users=read(),u=users.find(x=>x.email===email);if(!u)return json(res,200,{ok:true,message:'If that account exists, a reset email has been sent.'});u.password_reset_token=crypto.randomBytes(32).toString('hex');u.password_reset_expires=new Date(Date.now()+3600000).toISOString();write(users);if(process.env.DREAMIEZ_SMOKE==='true')return json(res,200,{ok:true,reset_url:ORIGIN+'/reset-password.html?token='+encodeURIComponent(u.password_reset_token)});try{await sendEmail(u.email,u.name,u.password_reset_token)}catch(e){return json(res,503,{error:e.message})}return json(res,200,{ok:true,message:'Password reset email sent.'})}
  if(req.method==='POST'&&url==='/api/account/password-reset/confirm'){const b=await body(req),token=String(b.token||''),password=String(b.password||'');if(password.length<8)return json(res,422,{error:'password must be at least 8 characters'});const users=read(),u=users.find(x=>x.password_reset_token===token);if(!u||!u.password_reset_expires||Date.parse(u.password_reset_expires)<Date.now())return json(res,400,{error:'reset link is invalid or expired'});const salt=crypto.randomBytes(16).toString('hex');u.password={salt,hash:crypto.scryptSync(password,salt,64).toString('hex')};u.password_reset_token=null;u.password_reset_expires=null;write(users);res.setHeader('Set-Cookie','dreamiez_session='+encodeURIComponent(u.id)+'; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax');return json(res,200,{ok:true,next:'/account.html'})}return false}
module.exports={handle};
