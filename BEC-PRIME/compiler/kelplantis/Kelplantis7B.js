'use strict';

function build7BScript() {
  return `
async function kelp7bRpc(name,args){
  const rt=G.realtime||{};
  if(!rt.url||!rt.publishableKey)throw new Error('7B Supabase transport unavailable');
  const r=await fetch(rt.url+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:rt.publishableKey,Authorization:'Bearer '+rt.publishableKey,'Content-Type':'application/json'},body:JSON.stringify(args||{})});
  const text=await r.text();let data=null;try{data=text?JSON.parse(text):null;}catch(_){data=text;}
  if(!r.ok)throw new Error((data&&data.message)||('RPC '+name+' failed '+r.status));return data;
}
let kelp7bPlayerReady=false,kelp7bEchoes=[];
const kelp7bBasePersist=persist;
persist=function(){kelp7bBasePersist();try{const k='kelplantis-dreammeez-'+state.id,v=JSON.parse(localStorage.getItem(k)||'null');if(v){v.no_sid=true;localStorage.setItem(k,JSON.stringify(v));}}catch(_){} };
async function kelp7bSyncLocal(){try{const k='kelplantis-dreammeez-'+state.id,v=JSON.parse(localStorage.getItem(k)||'null');if(v){v.no_sid=false;localStorage.setItem(k,JSON.stringify(v));}}catch(_){} }
async function kelp7bEnsurePlayer(){
  if(kelp7bPlayerReady)return;const current=state.id;
  if(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(current)){kelp7bPlayerReady=true;return;}
  const raw=await kelp7bRpc('kelplantis_create_player',{p_name:state.name,p_color_hue:140}),row=Array.isArray(raw)?raw[0]:raw;
  if(!row||!row.player_token)throw new Error('player creation returned no token');state.id=row.player_token;state.name=row.name||state.name;state.title=state.title||'New Arrival';history.replaceState(null,'','#'+state.id);kelp7bPlayerReady=true;persist();await kelp7bSyncLocal();
}
async function kelp7bResolveSpawn(){await kelp7bEnsurePlayer();const rows=await kelp7bRpc('kelplantis_resolve_spawn',{p_player_token:state.id}),row=Array.isArray(rows)?rows[0]:rows;if(!row)throw new Error('spawn resolution returned no row');state.x=Number(row.spawn_x);state.y=Number(row.spawn_y);state.moved=false;}
async function kelp7bClaimParcel(parcelKey){await kelp7bEnsurePlayer();const data=await kelp7bRpc('kelplantis_claim_parcel_for_token',{p_player_token:state.id,p_parcel_key:parcelKey});log('Parcel '+parcelKey+' claimed at '+data.x+','+data.y+'.');state.x=Number(data.x);state.y=Number(data.y);persist();await kelp7bSyncLocal();await kelp7bRefreshEchoes();draw();return data;}
async function kelp7bSetOffline(flag){if(!kelp7bPlayerReady)return;try{await kelp7bRpc('kelplantis_set_soul_anchor_for_token',{p_player_token:state.id,p_offline:flag,p_echo_state:{name:state.name,title:state.title,scars:state.scars,cosmetics:state.cosmetics,soul:state.soul},p_x:Math.round(state.x),p_y:Math.round(state.y)});}catch(e){log('7B anchor: '+e.message);}}
async function kelp7bRefreshEchoes(){try{const data=await kelp7bRpc('kelplantis_list_offline_soul_anchors',{});kelp7bEchoes=Array.isArray(data)?data.filter(a=>a.player_id!==state.id):[];}catch(e){log('7B echoes: '+e.message);}}
const kelp7bBaseDraw=draw;draw=function(){kelp7bBaseDraw();for(const e of kelp7bEchoes){const q=screen({x:Number(e.x),y:Number(e.y)});ctx.save();ctx.globalAlpha=.72;ctx.strokeStyle='#d8c57a';ctx.lineWidth=2;ctx.beginPath();ctx.arc(q.x,q.y,AV/2+5,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#d8c57a';ctx.font='11px system-ui';ctx.fillText((e.name||'Soul Echo')+' [offline]',q.x,q.y-34);if(e.title)ctx.fillText(e.title,q.x,q.y+36);ctx.restore();}};
async function kelp7bInspectEcho(e){try{const data=await kelp7bRpc('kelplantis_inspect_soul_anchor_for_token',{p_target_player_id:e.player_id,p_inspector_token:state.id});inspect(data);log('Inspected '+data.name+'\\'s Soul Tome.');}catch(err){log('Echo inspection: '+err.message);}}
c.addEventListener('click',function(e){const r=c.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*W/SCALE,y=(e.clientY-r.top)/r.height*H/SCALE;let best=null,bd=.9;for(const a of kelp7bEchoes){const d=Math.hypot(x-Number(a.x),y-Number(a.y));if(d<bd){bd=d;best=a;}}if(best)kelp7bInspectEcho(best);});
const kelp7bEnter=document.getElementById('enter');kelp7bEnter.onclick=async()=>{try{state.name=document.getElementById('name').value.trim()||state.name;await kelp7bEnsurePlayer();await kelp7bResolveSpawn();await kelp7bSetOffline(false);persist();await kelp7bSyncLocal();refreshPresence();log('Entered Depth 1 from '+(state.x===20&&state.y===20?'the Fountain':'your Soul Tome anchor')+'.');}catch(e){log('7B login: '+e.message);}};
const kelp7bClaim=document.createElement('button');kelp7bClaim.textContent='Claim Parcel P01';kelp7bClaim.onclick=()=>kelp7bClaimParcel('P01').catch(e=>log('Parcel: '+e.message));document.getElementById('bar').insertBefore(kelp7bClaim,document.getElementById('save'));
window.__KELPLANTIS_7B__={claimParcel:kelp7bClaimParcel,resolveSpawn:kelp7bResolveSpawn,setOffline:kelp7bSetOffline,refreshEchoes:kelp7bRefreshEchoes,inspectEcho:kelp7bInspectEcho,getEchoes:()=>kelp7bEchoes,ready:()=>kelp7bPlayerReady};
kelp7bEnsurePlayer().then(async()=>{await kelp7bResolveSpawn();await kelp7bSetOffline(false);await kelp7bSyncLocal();await kelp7bRefreshEchoes();draw();}).catch(e=>log('7B bootstrap: '+e.message));
window.addEventListener('beforeunload',()=>{try{kelp7bSetOffline(true);}catch(_){}});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){refreshPresence();kelp7bRefreshEchoes();}});
setInterval(()=>{if(kelp7bPlayerReady&&document.visibilityState==='visible')kelp7bRefreshEchoes();},5000);
`;
}
module.exports={build7BScript};
