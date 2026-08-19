'use strict';

function buildRuntimeHtml(spec, dungeon) {
  const g = spec.game;
  const data = JSON.stringify({ game: g, dungeon });
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${g.profile} - ${spec.name}</title><style>
body{margin:0;background:#080b0d;color:#eef2f3;font-family:system-ui,sans-serif}main{max-width:1000px;margin:auto;padding:14px}canvas{width:100%;height:auto;background:#111;border:1px solid #39434a;border-radius:10px}#hud{display:flex;gap:14px;flex-wrap:wrap;margin:8px 0;font-weight:700}button{padding:8px 12px;margin:3px;border:0;border-radius:6px;cursor:pointer}#log{min-height:24px;color:#b9d7c0}</style></head><body><main><h1>${spec.name}</h1><p>${spec.description}</p><div id="hud"><span>HP <b id="hp"></b></span><span>LV <b id="lv"></b></span><span>XP <b id="xp"></b></span><span>Gold <b id="gold"></b></span><span>Loot <b id="loot"></b></span><span>Zone <b id="zone"></b></span></div><button id="save">Save</button><button id="load">Load</button><button id="reset">Reset</button><canvas id="game" width="${g.width}" height="${g.height}" aria-label="Kelplantis ARPG"></canvas><p id="log">WASD/Arrows move. Space attacks. Enter the dungeon, defeat goblins, collect loot, level up, then defeat the floor boss. The town is safe.</p></main><script>
const DATA=${data};
const c=document.getElementById('game'),ctx=c.getContext('2d'),W=c.width,H=c.height;
const D=DATA.dungeon,G=DATA.game,SLOT=G.save.slot;
const sx=W/D.width,sy=H/D.height;
const roomCenter=r=>({x:(r.x+r.w/2)*sx,y:(r.y+r.h/2)*sy});
const state={x:G.town.x,y:G.town.y,hp:G.player.maxHealth,maxHp:G.player.maxHealth,level:1,xp:0,gold:0,loot:[],kills:0,bossDead:false,win:false,attackAt:0,last:performance.now()};
const enemies=[];
function spawnEnemies(){
  enemies.length=0;
  for(const pop of D.populations){const room=D.rooms.find(r=>r.id===pop.room_id);if(!room)continue;const n=pop.enemy_count[0]===pop.enemy_count[1]?pop.enemy_count[0]:pop.enemy_count[0]+Math.floor(Math.random()*(pop.enemy_count[1]-pop.enemy_count[0]+1));for(let i=0;i<n;i++){const id=pop.enemy_pool[i%pop.enemy_pool.length];const base=G.enemies.find(e=>e.id===id)||G.enemies[0];const cc=roomCenter(room);enemies.push({id,name:base.name,x:cc.x+(i%3-1)*22,y:cc.y+(Math.floor(i/3))*22,r:13,hp:base.health,maxHp:base.health,damage:base.damage,speed:base.speed*7,xp:base.xp,dead:false,boss:pop.room_tag==='boss_arena'&&i===0,hitAt:0});}}
}
spawnEnemies();
function log(t){document.getElementById('log').textContent=t}
function save(){localStorage.setItem(SLOT,JSON.stringify({x:state.x,y:state.y,hp:state.hp,level:state.level,xp:state.xp,gold:state.gold,loot:state.loot,kills:state.kills,bossDead:state.bossDead,win:state.win}));log('Game saved.');}
function load(){const raw=localStorage.getItem(SLOT);if(!raw){log('No save found.');return}Object.assign(state,JSON.parse(raw));log('Game loaded.');}
function reset(){localStorage.removeItem(SLOT);location.reload()}
document.getElementById('save').onclick=save;document.getElementById('load').onclick=load;document.getElementById('reset').onclick=reset;
const keys=new Set();addEventListener('keydown',e=>{keys.add(e.key.toLowerCase());if(e.key===' '){e.preventDefault();attack()}});addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
function inTown(){return dist(state,{x:G.town.x,y:G.town.y})<=G.town.radius}
function gainXp(v){state.xp+=v;while(state.xp>=G.player.levelXp*state.level){state.level++;state.maxHp+=15;state.hp=state.maxHp;log('Level up! You are now level '+state.level+'.')}}
function dropLoot(){if(Math.random()>G.player.lootDropChance)return;const item=G.loot.items[Math.floor(Math.random()*G.loot.items.length)];state.loot.push(item.id);state.gold+=item.value;log('Loot acquired: '+item.name+' (+ '+item.value+' gold)')}
function attack(){const now=performance.now();if(state.win||now<state.attackAt)return;state.attackAt=now+G.player.attackCooldownMs;let best=null,bd=62;for(const e of enemies)if(!e.dead){const d=dist(state,e);if(d<bd){bd=d;best=e}}if(!best)return;best.hp-=G.player.attackDamage;if(best.hp<=0){best.dead=true;state.kills++;gainXp(best.xp);if(best.boss){state.bossDead=true;state.win=true;log('Floor boss defeated. Kelplantis floor 1 cleared!')}else dropLoot()}}
function update(dt){if(state.win)return;let dx=0,dy=0;if(keys.has('w')||keys.has('arrowup'))dy--;if(keys.has('s')||keys.has('arrowdown'))dy++;if(keys.has('a')||keys.has('arrowleft'))dx--;if(keys.has('d')||keys.has('arrowright'))dx++;const l=Math.hypot(dx,dy)||1;state.x=Math.max(12,Math.min(W-12,state.x+dx/l*G.player.speed*dt));state.y=Math.max(12,Math.min(H-12,state.y+dy/l*G.player.speed*dt));
for(const e of enemies)if(!e.dead){const d=dist(state,e);if(d>20){e.x+=(state.x-e.x)/Math.max(d,1)*e.speed*dt;e.y+=(state.y-e.y)/Math.max(d,1)*e.speed*dt}else if(!inTown()){const now=performance.now();if(now>e.hitAt){e.hitAt=now+750;state.hp-=e.damage;if(state.hp<=0){state.hp=state.maxHp;state.x=G.town.x;state.y=G.town.y;log('Defeated. Returned safely to town.')}}}}
}
function draw(){ctx.clearRect(0,0,W,H);ctx.fillStyle='#162018';ctx.fillRect(0,0,W,H);
for(const r of D.rooms){ctx.fillStyle=r.tag==='boss_arena'?'#432020':r.tag==='rest'?'#203c2a':r.tag==='loot'?'#3a3218':'#1d2a22';ctx.fillRect(r.x*sx,r.y*sy,r.w*sx,r.h*sy);ctx.strokeStyle='#4b5c50';ctx.strokeRect(r.x*sx,r.y*sy,r.w*sx,r.h*sy)}
for(const co of D.corridors){const a=roomCenter(D.rooms[co.a]),b=roomCenter(D.rooms[co.b]);ctx.strokeStyle='#34483b';ctx.lineWidth=12;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke()}ctx.lineWidth=1;
ctx.fillStyle='#244c35';ctx.beginPath();ctx.arc(G.town.x,G.town.y,G.town.radius,0,Math.PI*2);ctx.fill();ctx.fillStyle='#dcefe0';ctx.textAlign='center';ctx.fillText('TOWN - SAFE',G.town.x,G.town.y+4);
for(const e of enemies)if(!e.dead){ctx.fillStyle=e.boss?'#c83b3b':'#8c6b38';ctx.beginPath();ctx.arc(e.x,e.y,e.r,0,Math.PI*2);ctx.fill();ctx.fillStyle='#111';ctx.fillRect(e.x-14,e.y-21,28,4);ctx.fillStyle='#65d46e';ctx.fillRect(e.x-14,e.y-21,28*Math.max(0,e.hp/e.maxHp),4)}
ctx.fillStyle='#5fd7ff';ctx.beginPath();ctx.arc(state.x,state.y,13,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#e8fbff';ctx.stroke();
if(state.win){ctx.fillStyle='#000b';ctx.fillRect(0,0,W,H);ctx.fillStyle='#fff';ctx.font='bold 34px system-ui';ctx.fillText('KELPLANTIS FLOOR 1 CLEARED',W/2,H/2)}}
function frame(now){const dt=Math.min(32,now-state.last);state.last=now;update(dt);draw();document.getElementById('hp').textContent=Math.max(0,Math.floor(state.hp))+'/'+state.maxHp;document.getElementById('lv').textContent=state.level;document.getElementById('xp').textContent=state.xp;document.getElementById('gold').textContent=state.gold;document.getElementById('loot').textContent=state.loot.length;document.getElementById('zone').textContent=inTown()?'TOWN':'DUNGEON';requestAnimationFrame(frame)}requestAnimationFrame(frame);
</script></body></html>`;
}

module.exports = { buildRuntimeHtml };
