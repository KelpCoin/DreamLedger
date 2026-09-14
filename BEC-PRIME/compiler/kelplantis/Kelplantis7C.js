'use strict';

function build7CScript() {
  return `
let kelp7cNodes=[],kelp7cSocket=null,kelp7cJoined=false,kelp7cRealtimeUpdates=0,kelp7cInventory={kelp:0,gold:0,pearls:0};
async function kelp7cRest(path,options){
  const rt=G.realtime||{};
  const r=await fetch(rt.url+path,Object.assign({headers:{apikey:rt.publishableKey,Authorization:'Bearer '+rt.publishableKey,'Content-Type':'application/json'}},options||{}));
  const text=await r.text();let data=null;try{data=text?JSON.parse(text):null;}catch(_){data=text;}
  if(!r.ok)throw new Error((data&&data.message)||('7C request failed '+r.status));return data;
}
async function kelp7cLoadNodes(){
  try{const data=await kelp7cRest('/rest/v1/kelplantis_resource_nodes?depth_id=eq.1&select=id,resource_type,x,y,amount,max_amount,respawn_at&order=y.asc,x.asc');kelp7cNodes=Array.isArray(data)?data:[];draw();return kelp7cNodes;}catch(e){log('7C nodes: '+e.message);return [];}
}
async function kelp7cLoadInventory(){
  await kelp7bEnsurePlayer();
  const rows=await kelp7cRest('/rest/v1/kelplantis_player_inventory?player_id=eq.'+encodeURIComponent(state.id)+'&select=kelp,gold,pearls');
  const row=Array.isArray(rows)&&rows[0];if(row)kelp7cInventory={kelp:Number(row.kelp)||0,gold:Number(row.gold)||0,pearls:Number(row.pearls)||0};
  update7cInventoryUi();return kelp7cInventory;
}
function update7cInventoryUi(){const el=document.getElementById('kelp7c-inventory');if(el)el.textContent='Kelp '+kelp7cInventory.kelp+' | Gold '+kelp7cInventory.gold+' | Pearls '+kelp7cInventory.pearls;}
async function kelp7cPlayer(){await kelp7bEnsurePlayer();return await kelp7bRpc('kelplantis_get_player',{p_token:state.id});}
async function kelp7cHarvestNode(nodeId){
  await kelp7bEnsurePlayer();
  const node=kelp7cNodes.find(n=>n.id===nodeId);if(!node)throw new Error('RESOURCE_NODE_NOT_FOUND');
  const distance=Math.hypot(state.x-Number(node.x),state.y-Number(node.y));
  if(distance>2.5)throw new Error('TOO_FAR_FROM_RESOURCE_NODE');
  const raw=await kelp7bRpc('kelplantis_harvest_resource_for_token',{p_player_token:state.id,p_node_id:nodeId});
  const result=Array.isArray(raw)?raw[0]:raw;
  log('Harvested '+result.yield_amount+' '+result.resource_type+'.');
  await kelp7cLoadNodes();await kelp7cLoadInventory();
  return result;
}
function kelp7cDrawNodes(){for(const n of kelp7cNodes){if(Number(n.amount)<=0)continue;const q=screen({x:Number(n.x),y:Number(n.y)});ctx.save();ctx.fillStyle='#73d69b';ctx.strokeStyle='#d8c57a';ctx.lineWidth=2;ctx.beginPath();ctx.arc(q.x,q.y,7,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#eef6f5';ctx.font='9px system-ui';ctx.fillText('KELP '+n.amount,q.x,q.y-10);ctx.restore();}}
const kelp7cBaseDraw=draw;draw=function(){kelp7cBaseDraw();kelp7cDrawNodes();};
const kelp7cPanel=document.createElement('div');kelp7cPanel.className='panel';kelp7cPanel.id='kelp7c-panel';kelp7cPanel.innerHTML='<b>Depth 1 gathering</b><div id="kelp7c-inventory">Kelp 0 | Gold 0 | Pearls 0</div><span>Walk near a node and press G, or use the button.</span>';
document.querySelector('main').insertBefore(kelp7cPanel,document.getElementById('game'));
const kelp7cButton=document.createElement('button');kelp7cButton.textContent='Harvest Nearby Kelp';kelp7cButton.onclick=async()=>{try{const n=kelp7cNodes.filter(v=>Number(v.amount)>0).sort((a,b)=>Math.hypot(state.x-a.x,state.y-a.y)-Math.hypot(state.x-b.x,state.y-b.y))[0];if(!n)throw new Error('NO_KELP_NODES');await kelp7cHarvestNode(n.id);}catch(e){log('7C harvest: '+e.message);}};document.getElementById('bar').insertBefore(kelp7cButton,document.getElementById('save'));
addEventListener('keydown',e=>{if(e.key.toLowerCase()==='g'&&document.activeElement.tagName!=='INPUT'){const n=kelp7cNodes.filter(v=>Number(v.amount)>0).sort((a,b)=>Math.hypot(state.x-a.x,state.y-a.y)-Math.hypot(state.x-b.x,state.y-b.y))[0];if(n)kelp7cHarvestNode(n.id).catch(err=>log('7C harvest: '+err.message));else log('No resource nodes available.');}});
function kelp7cStartRealtime(){
  const rt=G.realtime||{};if(!rt.url||!rt.publishableKey||typeof WebSocket==='undefined')return;
  const wsUrl=rt.url.replace(/^http/,'ws')+'/realtime/v1/websocket?apikey='+encodeURIComponent(rt.publishableKey)+'&vsn=1.0.0';kelp7cSocket=new WebSocket(wsUrl);
  kelp7cSocket.onopen=()=>{kelp7cSocket.send(JSON.stringify({event:'phx_join',topic:topic,payload:{config:{broadcast:{ack:false,self:false},presence:{enabled:false},postgres_changes:[{event:'*',schema:'public',table:'kelplantis_resource_nodes'}],private:false}},ref:'7c1',join_ref:'7c1'}));};
  kelp7cSocket.onmessage=e=>{let m;try{m=JSON.parse(e.data);}catch(_){return;}if(m.event==='phx_reply'&&m.payload&&m.payload.status==='ok'){kelp7cJoined=true;return;}if(m.event==='postgres_changes'){kelp7cRealtimeUpdates++;kelp7cLoadNodes();}};
  kelp7cSocket.onclose=()=>{kelp7cJoined=false;};
}
window.__KELPLANTIS_7C__={loadNodes:kelp7cLoadNodes,harvest:kelp7cHarvestNode,getNodes:()=>kelp7cNodes,getInventory:()=>({...kelp7cInventory}),getPlayer:kelp7cPlayer,realtimeUpdates:()=>kelp7cRealtimeUpdates,realtimeJoined:()=>kelp7cJoined};
kelp7cLoadNodes().then(async()=>{try{await kelp7cLoadInventory();}catch(e){log('7C inventory: '+e.message);}kelp7cStartRealtime();}).catch(e=>log('7C bootstrap: '+e.message));
`;
}
module.exports={build7CScript};
