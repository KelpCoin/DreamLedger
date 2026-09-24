import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const secretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
const SECRET_KEY = secretKeys
  ? JSON.parse(secretKeys).default
  : Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const db = createClient(SUPABASE_URL, SECRET_KEY);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-phinhaven-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const MAP = [
  [3,3,3,3,3,3,3,3,3,3,3,3],
  [3,1,1,0,0,0,0,0,1,1,1,3],
  [3,1,0,0,2,0,0,2,0,0,1,3],
  [3,0,0,1,1,0,0,1,1,0,0,3],
  [3,0,2,1,0,0,0,0,1,2,0,3],
  [3,0,0,0,0,1,1,0,0,0,0,3],
  [3,0,0,1,0,1,1,0,1,0,0,3],
  [3,0,2,1,0,0,0,0,1,2,0,3],
  [3,0,0,1,1,0,0,1,1,0,0,3],
  [3,1,0,0,2,0,0,2,0,0,1,3],
  [3,1,1,0,0,0,0,0,1,1,1,3],
  [3,3,3,3,3,3,3,3,3,3,3,3],
];
const KELP = new Set([
  "4,2","7,2","2,4","9,4","2,7","9,7","4,9","7,9"
]);
const MAX_HP = 10;
const PLAYER_DMG = 3;
const SKITTER_DMG = 2;
const SKITTER_HP = 8;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}
function cleanName(value: unknown) {
  return String(value ?? "").trim().replace(/[^a-zA-Z0-9 _'-]/g, "").slice(0, 24);
}
function randomSkitter(excluded: Set<string>) {
  const candidates: Array<{x:number;y:number}> = [];
  for (let y=1;y<MAP.length-1;y++) {
    for (let x=1;x<MAP[y].length-1;x++) {
      if (MAP[y][x] !== 3 && !excluded.has(x+","+y)) candidates.push({x,y});
    }
  }
  const p = candidates[Math.floor(Math.random()*candidates.length)];
  return {x:p.x,y:p.y,hp:SKITTER_HP};
}
function spawnSkitterState() {
  const out:any[] = [];
  const used = new Set<string>();
  for (let i=0;i<6;i++) {
    const s = randomSkitter(used);
    used.add(s.x+","+s.y);
    out.push(s);
  }
  return out;
}
function publicPlayer(p:any) {
  return {
    id:p.id, name:p.name, color_hue:p.color_hue, level:p.level, hp:p.hp,
    max_hp:p.max_hp, scene:p.scene, pos_x:p.pos_x, pos_y:p.pos_y
  };
}
async function getPlayer(token: string) {
  if (!token || token.length < 30) return null;
  const { data, error } = await db.from("phinhaven_players")
    .select("*").eq("player_token", token).maybeSingle();
  if (error || !data) return null;
  return data;
}
function worldPlayers(scene:string, selfId:string) {
  return db.from("phinhaven_players")
    .select("id,name,color_hue,level,hp,max_hp,scene,pos_x,pos_y")
    .eq("scene",scene)
    .neq("id",selfId)
    .gt("updated_at",new Date(Date.now()-10000).toISOString())
    .limit(20)
    .then(r => r.data ?? []);
}
async function chat(scene:string) {
  const { data } = await db.from("phinhaven_chat_messages")
    .select("id,player_id,player_name,scene,message,created_at")
    .eq("scene",scene).order("created_at",{ascending:false}).limit(30);
  return (data ?? []).reverse();
}
function normalizeDungeon(p:any) {
  const d = (p.dungeon_state && typeof p.dungeon_state === "object") ? p.dungeon_state : {};
  return {
    skitters: Array.isArray(d.skitters) ? d.skitters : spawnSkitterState(),
    fronds: Number(d.fronds ?? 0),
    kills: Number(d.kills ?? 0)
  };
}
async function stateResponse(p:any) {
  await db.from("phinhaven_players").update({updated_at:new Date().toISOString()}).eq("id",p.id);
  const [others, messages] = await Promise.all([worldPlayers(p.scene,p.id), chat(p.scene)]);
  const fresh = {...p, updated_at:new Date().toISOString()};
  return {
    player: publicPlayer(fresh),
    inventory: fresh.inventory ?? [],
    dungeon: p.scene === "DEPTH_2" ? normalizeDungeon(fresh) : null,
    players: [publicPlayer(fresh), ...others],
    chat: messages
  };
}
async function persist(p:any, patch:any) {
  const { data, error } = await db.from("phinhaven_players")
    .update({...patch,updated_at:new Date().toISOString()})
    .eq("id",p.id).select("*").single();
  if (error) throw error;
  return data;
}

const GAME_HTML="<!doctype html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1,viewport-fit=cover\">\n<title>PHINHAVEN MVP</title>\n<style>\n:root{--bg:#07141a;--panel:#0d2229;--line:#23434c;--teal:#4ecdc4;--text:#e0f5f2;--muted:#7a9aa3;--danger:#c45c5c}\n*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font-family:system-ui,sans-serif}\nmain{width:min(980px,100%);margin:auto;padding:10px;display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:10px}.panel{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:10px}\nh1,h2,p{margin:0}h1{font-size:1.1rem;color:var(--teal)}h2{font-size:1rem;margin-bottom:7px}.row{display:flex;gap:7px;align-items:center;flex-wrap:wrap}.spread{justify-content:space-between}\ncanvas{width:100%;aspect-ratio:4/3;display:block;background:#12303a;border-radius:8px}\nbutton,input{font:inherit}button{border:0;border-radius:8px;padding:9px 11px;background:var(--teal);color:#042;cursor:pointer;font-weight:700}button.secondary{background:#234;color:var(--text)}button.danger{background:var(--danger);color:#fff}\ninput{background:#08171d;color:var(--text);border:1px solid var(--line);border-radius:8px;padding:9px}\n#setup{position:fixed;inset:0;background:rgba(3,10,13,.94);display:grid;place-items:center;padding:16px;z-index:5}#setup.hidden{display:none}#setup .panel{width:min(440px,100%)}\n.stat{font-size:.84rem;color:var(--muted)}.stat b{color:var(--text)}#status{font-size:.75rem;color:var(--muted)}\n#players{display:grid;gap:5px}.player{display:flex;align-items:center;gap:7px;font-size:.82rem}.dot{width:11px;height:11px;border-radius:50%;border:1px solid white}\n#chat{height:200px;overflow:auto;background:#08171d;border-radius:8px;padding:7px;font-size:.8rem}.msg{margin-bottom:6px}.msg b{color:var(--teal)}.msg small{color:var(--muted)}\n#chatForm{display:flex;margin-top:7px}#chatForm input{flex:1;min-width:0}#controls{display:grid;grid-template-columns:repeat(3,54px);justify-content:center;gap:5px;margin-top:8px}.sp{visibility:hidden}\n@media(max-width:760px){main{grid-template-columns:1fr}}@media(max-width:480px){button{padding:10px}.panel{padding:8px}}\n</style>\n</head>\n<body>\n<div id=\"setup\"><section class=\"panel\"><h1>PHINHAVEN</h1><p style=\"margin-top:6px;color:var(--muted)\">Create a character. Open this page on a second phone, tablet or laptop and create another character. Both enter the same persistent world.</p><div style=\"height:12px\"></div><label>Name<br><input id=\"name\" maxlength=\"24\" placeholder=\"Character name\" style=\"width:100%\"></label><div style=\"height:8px\"></div><label>Avatar hue<br><input id=\"hue\" type=\"range\" min=\"0\" max=\"360\" value=\"175\" style=\"width:100%\"></label><div style=\"height:10px\"></div><button id=\"create\">Create character</button><p id=\"setupError\" style=\"color:var(--danger);margin-top:7px\"></p></section></div>\n<main>\n<section class=\"panel\">\n<div class=\"row spread\" style=\"margin-bottom:7px\"><h1>PHINHAVEN · <span id=\"scene\">Sanctuary</span></h1><span id=\"status\">Starting…</span></div>\n<canvas id=\"game\" width=\"768\" height=\"576\"></canvas>\n<div class=\"row\" style=\"margin-top:7px\"><button id=\"depth\">Enter Depth 2</button><button id=\"town\" class=\"secondary\">Return to Sanctuary</button><button id=\"new\" class=\"danger\">New character</button></div>\n<div id=\"controls\"><span class=\"sp\"></span><button data-move=\"0,-1\">▲</button><span class=\"sp\"></span><button data-move=\"-1,0\">◀</button><button data-move=\"0,1\">▼</button><button data-move=\"1,0\">▶</button></div>\n</section>\n<aside class=\"panel\">\n<h2>Character</h2><div class=\"stat\">Name <b id=\"charName\">—</b></div><div class=\"stat\">HP <b id=\"hp\">—</b></div><div class=\"stat\">Depth 2 loot <b id=\"loot\">0</b></div><div class=\"stat\">Kills <b id=\"kills\">0</b></div><div class=\"stat\">Banked items <b id=\"inventory\">0</b></div>\n<div style=\"height:10px\"></div><h2>Players here</h2><div id=\"players\"></div><div style=\"height:10px\"></div><h2>Chat</h2><div id=\"chat\"></div><form id=\"chatForm\"><input id=\"chatInput\" maxlength=\"240\" placeholder=\"Say something…\"><button>Send</button></form>\n</aside>\n</main>\n<script>\n(()=>{\"use strict\";\nconst API=location.origin+\"/functions/v1/phinhaven-mvp\",KEY=\"sb_publishable_O5JRD67KaU3SA9dFq-JIuQ_Pzs8pedj\",TK=\"phinhaven_mvp_token_v1\";\nconst $=id=>document.getElementById(id),canvas=$(\"game\"),ctx=canvas.getContext(\"2d\");let model=null,busy=false;\nconst esc=s=>String(s).replace(/[&<>\"']/g,c=>({\"&\":\"&amp;\",\"<\":\"&lt;\",\">\":\"&gt;\",'\"':\"&quot;\",\"'\":\"&#39;\"}[c])),hue=h=>\"hsl(\"+h+\",65%,58%)\";\nasync function api(action,body={}){const r=await fetch(API,{method:\"POST\",headers:{\"apikey\":KEY,\"Content-Type\":\"application/json\",\"x-phinhaven-token\":localStorage.getItem(TK)||\"\"},body:JSON.stringify({action,...body})});const d=await r.json().catch(()=>({error:\"Bad server response\"}));if(!r.ok)throw Error(d.error||\"Request failed\");return d}\nfunction render(){if(!model)return;const p=model.player;$(\"scene\").textContent=p.scene===\"TOWN\"?\"Sanctuary\":\"Depth 2\";$(\"charName\").textContent=p.name;$(\"hp\").textContent=p.hp+\"/\"+p.max_hp;$(\"loot\").textContent=model.dungeon?.fronds??0;$(\"kills\").textContent=model.dungeon?.kills??0;$(\"inventory\").textContent=(model.inventory||[]).length;$(\"depth\").disabled=p.scene!==\"TOWN\";$(\"town\").disabled=p.scene===\"TOWN\";$(\"players\").innerHTML=(model.players||[]).map(x=>'<div class=\"player\"><span class=\"dot\" style=\"background:'+hue(x.color_hue)+'\"></span>'+esc(x.name)+(x.id===p.id?\" (you)\":\"\")+\"</div>\").join(\"\")||'<span class=\"stat\">Nobody else nearby.</span>';$(\"chat\").innerHTML=(model.chat||[]).map(m=>'<div class=\"msg\"><b>'+esc(m.player_name)+\"</b>: \"+esc(m.message)+' <small>'+new Date(m.created_at).toLocaleTimeString([],{hour:\"2-digit\",minute:\"2-digit\"})+\"</small></div>\").join(\"\");$(\"chat\").scrollTop=$(\"chat\").scrollHeight;draw()}\nfunction draw(){const p=model.player,town=p.scene===\"TOWN\",cols=town?16:12,rows=12,tile=Math.min(canvas.width/cols,canvas.height/rows);ctx.clearRect(0,0,canvas.width,canvas.height);\nif(town){for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){ctx.fillStyle=(x+y)%2?\"#123039\":\"#10262b\";ctx.fillRect(x*tile,y*tile,tile,tile)}for(let x=2;x<14;x++){ctx.fillStyle=\"#31594d\";ctx.fillRect(x*tile,3*tile,tile,tile)}for(let y=4;y<10;y++){ctx.fillStyle=\"#31594d\";ctx.fillRect(6*tile,y*tile,tile,tile)}ctx.fillStyle=\"#6b5635\";ctx.fillRect(2*tile,10*tile,12*tile,tile);ctx.fillStyle=\"#f1d27a\";ctx.font=\"bold \"+Math.max(11,tile*.35)+\"px system-ui\";ctx.fillText(\"GUILD HALL / DEPTH BOARD\",3*tile,10.62*tile)}\nelse{const M=[[3,3,3,3,3,3,3,3,3,3,3,3],[3,1,1,0,0,0,0,0,1,1,1,3],[3,1,0,0,2,0,0,2,0,0,1,3],[3,0,0,1,1,0,0,1,1,0,0,3],[3,0,2,1,0,0,0,0,1,2,0,3],[3,0,0,0,0,1,1,0,0,0,0,3],[3,0,0,1,0,1,1,0,1,0,0,3],[3,0,2,1,0,0,0,0,1,2,0,3],[3,0,0,1,1,0,0,1,1,0,0,3],[3,1,0,0,2,0,0,2,0,0,1,3],[3,1,1,0,0,0,0,0,1,1,1,3],[3,3,3,3,3,3,3,3,3,3,3,3]];for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){let t=M[y][x];ctx.fillStyle=t===3?\"#1a3038\":t===1?\"#2a5a4a\":((x+y)%2?\"#1a4a5c\":\"#163d4a\");ctx.fillRect(x*tile,y*tile,tile,tile);if(t===2){ctx.fillStyle=\"#52b788\";ctx.beginPath();ctx.arc(x*tile+tile/2,y*tile+tile/2,7,0,Math.PI*2);ctx.fill()}}for(const s of model.dungeon?.skitters||[]){ctx.fillStyle=\"#8b5a2b\";ctx.beginPath();ctx.arc(s.x*tile+tile/2,s.y*tile+tile/2,Math.max(7,tile*.22),0,Math.PI*2);ctx.fill()}}\nfor(const q of model.players||[]){if(q.id===p.id)continue;ctx.fillStyle=hue(q.color_hue);ctx.beginPath();ctx.arc(q.pos_x*tile+tile/2,q.pos_y*tile+tile/2,Math.max(8,tile*.25),0,Math.PI*2);ctx.fill();ctx.fillStyle=\"#fff\";ctx.font=Math.max(9,tile*.22)+\"px system-ui\";ctx.fillText(q.name,q.pos_x*tile+3,q.pos_y*tile+10)}\nctx.fillStyle=hue(p.color_hue);ctx.beginPath();ctx.arc(p.pos_x*tile+tile/2,p.pos_y*tile+tile/2,Math.max(9,tile*.27),0,Math.PI*2);ctx.fill();ctx.strokeStyle=\"#fff\";ctx.lineWidth=2;ctx.stroke()}\nasync function refresh(){try{model=await api(\"state\");$(\"status\").textContent=\"Live\";render()}catch(e){$(\"status\").textContent=\"Offline\";console.error(e)}}\nasync function act(fn){if(busy)return;busy=true;try{model=await fn();render()}catch(e){$(\"status\").textContent=\"Error\";console.error(e)}finally{busy=false}}\nconst move=(x,y)=>act(()=>api(\"move\",{dx:x,dy:y}));\ndocument.addEventListener(\"keydown\",e=>{if([\"INPUT\",\"TEXTAREA\"].includes(document.activeElement.tagName))return;let k=e.key.toLowerCase();if(k===\"w\"||k===\"arrowup\")move(0,-1);if(k===\"s\"||k===\"arrowdown\")move(0,1);if(k===\"a\"||k===\"arrowleft\")move(-1,0);if(k===\"d\"||k===\"arrowright\")move(1,0)});\ndocument.querySelectorAll(\"[data-move]\").forEach(b=>b.onclick=()=>{let[x,y]=b.dataset.move.split(\",\").map(Number);move(x,y)});\n$(\"depth\").onclick=()=>act(()=>api(\"enter_depth\"));$(\"town\").onclick=()=>act(()=>api(\"return_town\"));$(\"new\").onclick=()=>{localStorage.removeItem(TK);location.reload()};\n$(\"create\").onclick=async()=>{try{let d=await api(\"create\",{name:$(\"name\").value.trim(),color_hue:Number($(\"hue\").value)});localStorage.setItem(TK,d.token);model=d;$(\"setup\").classList.add(\"hidden\");render()}catch(e){$(\"setupError\").textContent=e.message}};\n$(\"chatForm\").onsubmit=e=>{e.preventDefault();let m=$(\"chatInput\").value.trim();if(!m)return;$(\"chatInput\").value=\"\";act(()=>api(\"chat\",{message:m}))};\n(async()=>{if(localStorage.getItem(TK)){ $(\"setup\").classList.add(\"hidden\");await refresh()}})();setInterval(()=>{if(localStorage.getItem(TK)&&!busy)refresh()},1000);\n})();\n</script>\n</body></html>";

Deno.serve(async (req) => {
  if (req.method === "GET") return new Response(GAME_HTML,{status:200,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"}});
  if (req.method === "OPTIONS") return new Response("ok", {headers:CORS});
  if (req.method !== "POST") return json({error:"POST required"},405);

  try {
    const body = await req.json();
    const action = String(body.action ?? "");
    let p:any = null;

    if (action === "create") {
      const name = cleanName(body.name);
      if (name.length < 2) return json({error:"Character name must be 2-24 characters."},400);
      const hue = Math.max(0, Math.min(360, Number(body.color_hue ?? 175)));
      const { data, error } = await db.from("phinhaven_players").insert({
        name, color_hue:hue, level:1, xp:0, hp:MAX_HP, max_hp:MAX_HP,
        scene:"TOWN", pos_x:6, pos_y:6, inventory:[], equipped:{},
        floor_progress:{}, dungeon_state:null, current_encounter:null, quest_state:{},
        home_decor:{wall_color:"clay",floor_style:"plain",display_message:""}
      }).select("*").single();
      if (error) return json({error:error.message},400);
      return json({
        token:data.player_token,
        ...await stateResponse(data)
      });
    }

    p = await getPlayer(String(req.headers.get("x-phinhaven-token") ?? body.token ?? ""));
    if (!p) return json({error:"Invalid PHINHAVEN player token."},401);

    if (action === "state") return json(await stateResponse(p));

    if (action === "enter_depth") {
      const d = {skitters:spawnSkitterState(),fronds:0,kills:0};
      p = await persist(p,{scene:"DEPTH_2",pos_x:5,pos_y:10,hp:MAX_HP,dungeon_state:d});
      return json(await stateResponse(p));
    }

    if (action === "return_town") {
      const d = normalizeDungeon(p);
      const inventory = Array.isArray(p.inventory) ? [...p.inventory] : [];
      for (let i=0;i<d.fronds;i++) inventory.push("Kelp Frond");
      p = await persist(p,{scene:"TOWN",pos_x:6,pos_y:6,hp:MAX_HP,inventory,dungeon_state:null});
      return json(await stateResponse(p));
    }

    if (action === "move") {
      const dx = Math.max(-1,Math.min(1,Number(body.dx ?? 0)));
      const dy = Math.max(-1,Math.min(1,Number(body.dy ?? 0)));
      if (Math.abs(dx)+Math.abs(dy) !== 1) return json({error:"One-tile movement only."},400);
      const maxX = p.scene === "DEPTH_2" ? 11 : 15;
      const maxY = p.scene === "DEPTH_2" ? 11 : 11;
      let nx = Number(p.pos_x)+dx, ny=Number(p.pos_y)+dy;
      if (nx<1 || ny<1 || nx>maxX-1 || ny>maxY-1) return json(await stateResponse(p));
      if (p.scene === "DEPTH_2" && MAP[ny]?.[nx] === 3) return json(await stateResponse(p));

      if (p.scene === "DEPTH_2") {
        const d = normalizeDungeon(p);
        const enemyIndex = d.skitters.findIndex((s:any)=>s.x===nx && s.y===ny);
        if (enemyIndex >= 0) {
          let ehp = Number(d.skitters[enemyIndex].hp);
          let php = Number(p.hp);
          while (ehp > 0 && php > 0) {
            ehp -= PLAYER_DMG;
            if (ehp <= 0) break;
            php -= SKITTER_DMG;
          }
          if (php <= 0) {
            p = await persist(p,{scene:"TOWN",pos_x:6,pos_y:6,hp:MAX_HP,dungeon_state:null});
            return json({event:"DEATH",message:"You fell. Unbanked fronds were lost.",...(await stateResponse(p))});
          }
          d.skitters.splice(enemyIndex,1);
          d.kills += 1;
          p = await persist(p,{pos_x:p.pos_x,pos_y:p.pos_y,hp:php,dungeon_state:d});
          if (d.kills >= 5 || d.fronds >= 6) {
            const fp = {...(p.floor_progress ?? {}),depth_2:{cleared:true}};
            p = await persist(p,{floor_progress:fp});
          }
          return json({event:"SKITTER_DEFEATED",...(await stateResponse(p))});
        }
        p = await persist(p,{pos_x:nx,pos_y:ny});
        const key = nx+","+ny;
        const d = normalizeDungeon(p);
        if (KELP.has(key) && d.fronds < 6) {
          d.fronds += 1;
          p = await persist(p,{dungeon_state:d});
          if (d.fronds >= 6 || d.kills >= 5) {
            p = await persist(p,{floor_progress:{...(p.floor_progress??{}),depth_2:{cleared:true}}});
          }
        }
      } else {
        p = await persist(p,{pos_x:nx,pos_y:ny});
      }
      return json(await stateResponse(p));
    }

    if (action === "chat") {
      const message = String(body.message ?? "").trim().slice(0,240);
      if (!message) return json({error:"Empty message."},400);
      const {error} = await db.from("phinhaven_chat_messages").insert({
        player_id:p.id, player_name:p.name, scene:p.scene, message
      });
      if (error) return json({error:error.message},400);
      p = await persist(p,{});
      return json(await stateResponse(p));
    }

    return json({error:"Unknown action."},400);
  } catch (e) {
    return json({error:String(e?.message ?? e)},500);
  }
});