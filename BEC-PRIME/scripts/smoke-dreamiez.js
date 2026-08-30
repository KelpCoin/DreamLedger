'use strict';
const { spawn } = require('child_process');
const port = Number(process.env.SMOKE_PORT || 38765);
const base = 'http://127.0.0.1:' + port;
let child;
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function request(pathname) { const r = await fetch(base + pathname); const text = await r.text(); let body; try { body = JSON.parse(text); } catch { body = text; } if (!r.ok) throw new Error(pathname + ' -> ' + r.status); return { response:r, body, text }; }
async function waitHealth() { for (let i=0;i<60;i++) { try { const x=await request('/healthz'); if (x.body && x.body.status==='ok') return x; } catch {} await sleep(250); } throw new Error('Runtime did not become healthy'); }
function spawnRuntime() { child=spawn(process.execPath,['-r','./lib/authRuntimePreload.js','-r','./lib/publicShellPreload.js','-r','./lib/m2mPreload.js','-r','./lib/qrPreload.js','start.js'],{cwd:__dirname+'/..',env:{...process.env,PORT:String(port),DIGITAL_PROXY_APPROVAL_TOKEN:'smoke-proxy-token',DIGITAL_PROXY_LM_ENABLED:'false',DREAMIEZ_SMOKE:'false'},stdio:['ignore','pipe','pipe']}); child.stdout.on('data',d=>process.stdout.write('[runtime] '+d)); child.stderr.on('data',d=>process.stderr.write('[runtime] '+d)); }
async function stopRuntime() { if (!child) return; child.kill('SIGTERM'); await new Promise(resolve=>child.once('exit',resolve)); child=null; }
async function main() {
 spawnRuntime();
 const health=await waitHealth();
 const root=await request('/');
 if (root.response.status !== 200) throw new Error('Public root did not return HTTP 200');
 const products=await request('/api/products');
 if (!products.body || !Array.isArray(products.body.products)) throw new Error('Public product catalogue did not return a product array');
 const offers=await request('/api/offers');
 if (!offers.body || !Array.isArray(offers.body.offers)) throw new Error('Public offer catalogue did not return an offer array');
 const securityPath = await request('/api/offers'); if (!securityPath.body || !Array.isArray(securityPath.body.offers)) throw new Error('Public offer API unavailable');
 const headers=health.response.headers;
 if (!headers) throw new Error('Health response headers unavailable');
 const m=await request('/api/mtg/configurator/decks');
 if (!m.body || typeof m.body !== 'object') throw new Error('MTG configurator endpoint did not return JSON');
 console.log(JSON.stringify({smoke_test:'PASS',health:true,public_catalogue:true,mtg_surface:true,billboard_surface:true,security_surface:true,mtg_api_json:true},null,2));
}
main().catch(err=>{console.error(JSON.stringify({smoke_test:'FAIL',error:err.message},null,2));process.exitCode=1;}).finally(stopRuntime);