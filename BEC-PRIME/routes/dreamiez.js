'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data', 'dreamiez');
const USERS = path.join(DATA, 'users.json');
const GUILDS = path.join(DATA, 'guilds.json');
const COSMETICS = path.join(DATA, 'cosmetics.json');
function read(file, fallback){try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return fallback;}}
function write(file,value){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n');}
function cookie(req,name){const h=String(req.headers.cookie||'');const m=h.match(new RegExp('(?:^|;\\s*)'+name+'=([^;]+)'));return m?decodeURIComponent(m[1]):null;}
function userId(req,res){let id=cookie(req,'dreamiez_id');if(!id){id='u_'+crypto.randomBytes(6).toString('hex');res.setHeader('Set-Cookie','dreamiez_id='+encodeURIComponent(id)+'; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax');}return id;}
function passwordRecord(password){const salt=crypto.randomBytes(16).toString('hex');const hash=crypto.scryptSync(password,salt,64).toString('hex');return{salt,hash};}
function verifyPassword(password,record){if(!record||!record.salt||!record.hash)return false;const a=Buffer.from(crypto.scryptSync(password,record.salt,64).toString('hex'),'hex');const b=Buffer.from(record.hash,'hex');return a.length===b.length&&crypto.timingSafeEqual(a,b);}
function publicUser(u){return{id:u.id,email:u.email||null,name:u.name||'Dreamer',account_created:Boolean(u.email),avatar:u.avatar,cosmetics:u.cosmetics,streak:u.streak,guild:u.guild};}
function ensureUser(id){const users=read(USERS,[]);let u=users.find(x=>x.id===id);if(!u){u={id,avatar:{height:1,build:1,skin:5},cosmetics:[],streak:0,lastVisit:null,guild:null};users.push(u);write(USERS,users);}const today=new Date().toISOString().slice(0,10);if(u.lastVisit!==today){const yesterday=new Date(Date.now()-86400000).toISOString().slice(0,10);u.streak=u.lastVisit===yesterday?u.streak+1:1;u.lastVisit=today;for(const c of read(COSMETICS,[])){if(c.streak_reward&&u.streak>=c.streak_reward&&!u.cosmetics.includes(c.id))u.cosmetics.push(c.id);}write(USERS,users);}return u;}
async function body(req){return new Promise((resolve,reject)=>{let s='';req.on('data',c=>{s+=c;if(s.length>1000000)req.destroy();});req.on('end',()=>{try{resolve(s?JSON.parse(s):{});}catch(e){reject(e);}});req.on('error',reject);});}
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
async function handle(req,res,url){
 if(!url.startsWith('/api/dreamiez')&&!url.startsWith('/dreamiez'))return false;
 if(req.method==='GET'&&url==='/dreamiez'){res.writeHead(302,{Location:'/dreamiez/dreamiez.html'});res.end();return true;}
 const id=userId(req,res);const u=ensureUser(id);
 if(req.method==='POST'&&url==='/api/dreamiez/account/create'){const b=await body(req);const email=String(b.email||'').trim().toLowerCase();const name=String(b.name||'Dreamer').trim().slice(0,40)||'Dreamer';const password=String(b.password||'');if(!/^\S+@\S+\.\S+$/.test(email))return json(res,422,{error:'valid email required'});if(password.length<8)return json(res,422,{error:'password must be at least 8 characters'});const users=read(USERS,[]);const existing=users.find(x=>x.email===email);if(existing&&existing.id!==id)return json(res,409,{error:'account already exists'});u.email=email;u.name=name;u.password=passwordRecord(password);u.account_created_at=new Date().toISOString();write(USERS,users);return json(res,201,{ok:true,user:publicUser(u),next:'/dreamiez'});}
 if(req.method==='POST'&&url==='/api/dreamiez/account/login'){const b=await body(req);const email=String(b.email||'').trim().toLowerCase();const password=String(b.password||'');const users=read(USERS,[]);const found=users.find(x=>x.email===email);if(!found||!verifyPassword(password,found.password))return json(res,401,{error:'invalid email or password'});res.setHeader('Set-Cookie','dreamiez_id='+encodeURIComponent(found.id)+'; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax');return json(res,200,{ok:true,user:publicUser(found),next:'/dreamiez'});}
 if(req.method==='GET'&&url==='/api/dreamiez/me')return json(res,200,publicUser(u));
 if(req.method==='GET'&&url==='/api/dreamiez/cosmetics')return json(res,200,read(COSMETICS,[]));
 if(req.method==='POST'&&url==='/api/dreamiez/avatar'){const b=await body(req);if(typeof b.height!=='number'||typeof b.build!=='number'||typeof b.skin!=='number')return json(res,422,{error:'invalid avatar'});const users=read(USERS,[]);const x=users.find(v=>v.id===id);x.avatar={height:b.height,build:b.build,skin:b.skin};write(USERS,users);return json(res,200,{success:true});}
 if(req.method==='POST'&&url==='/api/dreamiez/cosmetics/claim'){const b=await body(req);const c=read(COSMETICS,[]).find(x=>x.id===b.cosmetic_id);if(!c||!c.streak_reward||u.streak<c.streak_reward)return json(res,403,{error:'streak reward not unlocked'});if(!u.cosmetics.includes(c.id))u.cosmetics.push(c.id);write(USERS,read(USERS,[]));return json(res,200,{success:true});}
 if(req.method==='GET'&&url==='/api/dreamiez/guilds/my'){const guild=read(GUILDS,[]).find(g=>g.id===u.guild)||null;return json(res,200,{guild});}
 if(req.method==='POST'&&url==='/api/dreamiez/guilds'){const b=await body(req);const name=String(b.name||'').trim();if(!name)return json(res,400,{error:'name required'});if(u.guild)return json(res,409,{error:'already in a guild'});const guilds=read(GUILDS,[]);const guild={id:'g_'+crypto.randomBytes(4).toString('hex'),name,tag:name.replace(/[^A-Za-z0-9]/g,'').slice(0,4).toUpperCase(),members:[id],leader:id,created:new Date().toISOString()};guilds.push(guild);u.guild=guild.id;write(GUILDS,guilds);const users=read(USERS,[]);users.find(x=>x.id===id).guild=guild.id;write(USERS,users);return json(res,201,guild);}
 if(req.method==='GET'&&url==='/api/dreamiez/leaderboard'){const list=read(USERS,[]).map(x=>({name:x.name||x.id.slice(0,8),score:(x.streak||0)*10+(x.cosmetics||[]).length*5})).sort((a,b)=>b.score-a.score);return json(res,200,list);}
 return false;
}
module.exports={handle};
