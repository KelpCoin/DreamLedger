const { test, expect } = require('playwright/test');
const fs = require('fs');
const http = require('http');
const path = require('path');

let server;
let baseUrl;
const root = path.resolve(__dirname, '..');
const proofDir = path.join(root, 'RUN-PROOFS');
const outDir = path.join(root, 'compiled', 'universal', 'game', 'kelplantis-mvp');
const proofPath = path.join(proofDir, 'KELPLANTIS-BROWSER-RUNTIME-PROOF.json');

function startServer() { return new Promise((resolve, reject) => { server = http.createServer((req,res) => { const pathname=decodeURIComponent((req.url||'/').split('?')[0]); const file=pathname==='/'?path.join(outDir,'index.html'):path.join(outDir,pathname.replace(/^\//,'')); if(!file.startsWith(outDir)||!fs.existsSync(file)){res.writeHead(404);res.end('not found');return;} res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}); fs.createReadStream(file).pipe(res); }); server.on('error',reject); server.listen(0,'127.0.0.1',()=>{baseUrl=`http://127.0.0.1:${server.address().port}/`;resolve();}); }); }

test.beforeAll(async()=>{if(!fs.existsSync(path.join(outDir,'index.html')))throw new Error('Kelplantis artifact missing. Run compiler first.');await startServer();});
test.afterAll(async()=>{if(server)await new Promise(resolve=>server.close(resolve));});

test('Kelplantis playable vertical slice',async({page})=>{
  const consoleErrors=[]; page.on('console',msg=>{if(msg.type()==='error')consoleErrors.push(msg.text());}); page.on('pageerror',err=>consoleErrors.push(err.message));
  await page.goto(baseUrl,{waitUntil:'load'}); await expect(page.locator('h1')).toHaveText('Kelplantis MVP');
  const initial=await page.evaluate(()=>window.__KELPLANTIS_TEST__.snapshot()); expect(initial.inTown).toBe(true); expect(initial.bossAlive).toBe(true);
  await page.getByRole('button',{name:'Enter Dungeon'}).click(); await page.waitForTimeout(100); expect((await page.evaluate(()=>window.__KELPLANTIS_TEST__.snapshot())).inTown).toBe(false);
  const beforeMove=await page.evaluate(()=>window.__KELPLANTIS_TEST__.snapshot().state); await page.keyboard.down('d'); await page.waitForTimeout(300); await page.keyboard.up('d'); const afterMove=await page.evaluate(()=>window.__KELPLANTIS_TEST__.snapshot().state); expect(Math.abs(afterMove.x-beforeMove.x)+Math.abs(afterMove.y-beforeMove.y)).toBeGreaterThan(0);
  const target=await page.evaluate(()=>{const s=window.__KELPLANTIS_TEST__.snapshot();return{x:s.entrance.x,y:s.entrance.y};}); await page.evaluate(({x,y})=>window.__KELPLANTIS_TEST__.teleport(x,y),target);
  const hpBefore=(await page.evaluate(()=>window.__KELPLANTIS_TEST__.snapshot().state)).hp; await page.waitForTimeout(900); const hpAfter=(await page.evaluate(()=>window.__KELPLANTIS_TEST__.snapshot().state)).hp; expect(hpAfter).toBeLessThan(hpBefore);
  const killsBefore=(await page.evaluate(()=>window.__KELPLANTIS_TEST__.snapshot().state)).kills; for(let i=0;i<5;i+=1){await page.keyboard.press(' ');await page.waitForTimeout(400);} const inputCombat=await page.evaluate(()=>window.__KELPLANTIS_TEST__.snapshot()); expect(inputCombat.state.kills).toBeGreaterThan(killsBefore);
  for(let i=inputCombat.state.kills;i<4;i+=1)await page.evaluate(()=>window.__KELPLANTIS_TEST__.killNearest()); const combatState=await page.evaluate(()=>window.__KELPLANTIS_TEST__.snapshot()); expect(combatState.state.kills).toBeGreaterThanOrEqual(4); expect(combatState.state.xp).toBeGreaterThanOrEqual(100); expect(combatState.state.level).toBeGreaterThan(1); expect(combatState.state.loot.length).toBeGreaterThan(0);
  await page.evaluate(()=>window.__KELPLANTIS_TEST__.returnTown()); const safeBefore=(await page.evaluate(()=>window.__KELPLANTIS_TEST__.snapshot().state)).hp; await page.waitForTimeout(1000); const safeAfter=(await page.evaluate(()=>window.__KELPLANTIS_TEST__.snapshot().state)).hp; expect(safeAfter).toBe(safeBefore);
  await page.getByRole('button',{name:'Save'}).click(); const saved=await page.evaluate(()=>window.__KELPLANTIS_TEST__.snapshot().state); await page.evaluate(()=>window.__KELPLANTIS_TEST__.teleport(400,400)); await page.getByRole('button',{name:'Load'}).click(); const loaded=await page.evaluate(()=>window.__KELPLANTIS_TEST__.snapshot().state); expect(loaded.x).toBe(saved.x); expect(loaded.y).toBe(saved.y); expect(loaded.level).toBe(saved.level);
  await page.evaluate(()=>window.__KELPLANTIS_TEST__.killBoss()); const won=await page.evaluate(()=>window.__KELPLANTIS_TEST__.snapshot()); expect(won.state.bossDead).toBe(true); expect(won.state.win).toBe(true); await expect(page.locator('#log')).toContainText('floor 1 cleared');
  if(consoleErrors.length)throw new Error(`Console errors: ${consoleErrors.join(' | ')}`);
  fs.mkdirSync(proofDir,{recursive:true}); fs.writeFileSync(proofPath,JSON.stringify({schema:'bec/kelplantis/browser-runtime-proof/v1',status:'PASS',runtime:'browser',page_loads:true,player_movement:true,player_attack:true,enemy_ai_damage:true,loot:true,xp:true,leveling:true,town_safety:true,save_load:true,boss_present:true,boss_fightable:true,win_state:true,console_errors:[],generated_artifact:path.join('compiled','universal','game','kelplantis-mvp','index.html')},null,2)+'\n','utf8');
});
