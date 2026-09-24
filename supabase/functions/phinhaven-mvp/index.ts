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

Deno.serve(async (req) => {
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