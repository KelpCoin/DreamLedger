# ============================================================
# DreamLedger MTG Silo – PRODUCTION SEAL (FINAL)
# Save as Deploy-MTG.ps1, run from project root.
# ============================================================
$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $PSCommandPath)

# Preflight (Git optional)
if (Test-Path ".git") { if (git status --porcelain) { throw "Dirty working tree." } }
$isRender = ($env:RENDER -eq "true")
if ($isRender) {
    $missing = @()
    if (-not (Test-Path Env:MTG_ADMIN_PASSWORD_HASH)) { $missing += "MTG_ADMIN_PASSWORD_HASH" }
    if (-not (Test-Path Env:JWT_SECRET))           { $missing += "JWT_SECRET" }
    if (-not (Test-Path Env:CSRF_SECRET))           { $missing += "CSRF_SECRET" }
    if (-not (Test-Path Env:COOKIE_SECRET))         { $missing += "COOKIE_SECRET" }
    if ($missing.Count) { throw "Missing env: $($missing -join ', ')" }
    if (-not (Test-Path "/data")) { throw "/data missing" }
}

# Backup
$ts = Get-Date -Format "yyyy-MM-dd-HHmmss"
$backupDir = "backups/mtg-deploy/$ts"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
@("server.js","silos","public/mtg","public/mtg-admin","data/mtg-images") | ForEach-Object {
    if (Test-Path $_) { Copy-Item -Recurse $_ "$backupDir/$_" -Force -ErrorAction SilentlyContinue }
}
Write-Host "📦 Backup: $backupDir" -ForegroundColor Green

# Dependencies
$required = @("cookie-parser","jsonwebtoken","multer","better-sqlite3","uuid","express-rate-limit","csrf-csrf","helmet","file-type","bcryptjs","sharp")
$missing = $required | Where-Object { -not (Test-Path "node_modules/$_") }
if ($missing) { npm install --save $missing; if ($LASTEXITCODE -ne 0) { throw "npm install failed" } }
Write-Host "✅ Dependencies ready" -ForegroundColor Green

# Directories
$dirs = @("public/mtg","public/mtg-admin","data/mtg-images","silos/mtg","logs","backups")
foreach ($d in $dirs) { New-Item -ItemType Directory -Force -Path $d | Out-Null }

# Config
@'
{ "name": "MTG", "slug": "mtg", "route": "/mtg", "apiPrefix": "/api/mtg", "catalog": "public/mtg/catalog.json", "imageRoot": "data/mtg-images", "version": "1.0-template", "databasePrefix": "mtg_" }
'@ | Out-File -FilePath "silos/mtg/config.json" -Encoding utf8

# ============================================================
# Backend files (with the two critical fixes)
# ============================================================
Write-Host "📝 Writing silo backend..." -ForegroundColor Cyan

# --- database.js ---
@'
const Database = require('better-sqlite3'); const path = require('path'); const fs = require('fs');
const DB_PATH = process.env.DB_PATH || (process.env.RENDER === 'true' ? '/data/dreamledger.db' : path.join(__dirname, '..', '..', 'data', 'dreamledger.db'));
const dbDir = path.dirname(DB_PATH); if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
const db = new Database(DB_PATH); db.pragma('journal_mode = WAL'); const PREFIX = 'mtg_';
function migrate() {
  db.exec(`CREATE TABLE IF NOT EXISTS ${PREFIX}migrations(id TEXT PRIMARY KEY, applied_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  const applied = db.prepare(`SELECT id FROM ${PREFIX}migrations`).all().map(r => r.id);
  const list = [
    [`${PREFIX}001_initial_listings`, `CREATE TABLE IF NOT EXISTS ${PREFIX}listings (id TEXT PRIMARY KEY, sku TEXT, silo TEXT DEFAULT 'mtg', type TEXT NOT NULL DEFAULT 'deck', title TEXT NOT NULL, set_name TEXT, collector_number TEXT, commander TEXT, condition TEXT DEFAULT 'NM', price_nzd REAL, description TEXT, image_url TEXT, purchase_url TEXT, status TEXT DEFAULT 'pending', owner_id TEXT DEFAULT 'dreamledger', created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`],
    [`${PREFIX}002_audit_log`, `CREATE TABLE IF NOT EXISTS ${PREFIX}admin_actions (id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP, action TEXT NOT NULL, listing_id TEXT, ip TEXT, details TEXT)`],
    [`${PREFIX}003_sessions`, `CREATE TABLE IF NOT EXISTS ${PREFIX}admin_sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT UNIQUE NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, expires_at DATETIME, revoked INTEGER DEFAULT 0, ip TEXT, user_agent TEXT)`],
    [`${PREFIX}004_security_events`, `CREATE TABLE IF NOT EXISTS ${PREFIX}security_events (id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP, event TEXT NOT NULL, ip TEXT, user_agent TEXT, severity TEXT DEFAULT 'info', metadata TEXT)`],
    [`${PREFIX}005_indexes`, `CREATE INDEX IF NOT EXISTS idx_mtg_listing_status ON ${PREFIX}listings(status); CREATE INDEX IF NOT EXISTS idx_mtg_listing_created ON ${PREFIX}listings(created_at); CREATE INDEX IF NOT EXISTS idx_mtg_sessions_expires ON ${PREFIX}admin_sessions(expires_at); CREATE INDEX IF NOT EXISTS idx_mtg_security_events_time ON ${PREFIX}security_events(timestamp);`]
  ];
  for (const [id, sql] of list) { if (!applied.includes(id)) { console.log('[MTG MIGRATION]', id); db.exec(sql); db.prepare(`INSERT INTO ${PREFIX}migrations(id) VALUES(?)`).run(id); } }
}
function init() { migrate(); console.log('[MTG DB] Tables ready'); return Promise.resolve(); }
module.exports = { db, init, PREFIX };
'@ | Out-File -FilePath "silos/mtg/database.js" -Encoding utf8

# --- auth.js ---
@'
const jwt = require('jsonwebtoken'); const bcrypt = require('bcryptjs'); const { db, PREFIX } = require('./database');
const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';
if (isProduction) { if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET missing'); if (!process.env.MTG_ADMIN_PASSWORD_HASH) throw new Error('MTG_ADMIN_PASSWORD_HASH missing'); } else { throw new Error('Production mode required.'); }
function signToken(payload) { return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' }); }
function verifyToken(token) { return jwt.verify(token, process.env.JWT_SECRET); }
async function verifyPassword(input) { return typeof input === 'string' && bcrypt.compare(input, process.env.MTG_ADMIN_PASSWORD_HASH); }
async function authMiddleware(req, res, next) {
  const token = req.cookies?.mtg_admin_token; if (!token) return res.redirect('/mtg-admin/login.html');
  try { const payload = verifyToken(token); if (payload.sessionId) { const session = db.prepare(`SELECT * FROM ${PREFIX}admin_sessions WHERE session_id=? AND revoked=0 AND expires_at > datetime('now')`).get(payload.sessionId); if (!session) throw new Error('Session invalid'); } req.adminSession = payload; return next(); }
  catch (e) { res.clearCookie('mtg_admin_token', { httpOnly:true, sameSite:'strict', secure:isProduction, path:'/' }); return res.redirect('/mtg-admin/login.html'); }
}
module.exports = { signToken, verifyToken, authMiddleware, verifyPassword, isProduction };
'@ | Out-File -FilePath "silos/mtg/auth.js" -Encoding utf8

# --- security.js (FIXED) ---
@'
const rateLimit = require('express-rate-limit'); const { doubleCsrf } = require('csrf-csrf'); const { ipKeyGenerator } = require('express-rate-limit');
const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true'; const csrfSecret = process.env.CSRF_SECRET || (() => { throw new Error('CSRF_SECRET missing'); })();
function originGuard(req, res, next) { if (isProduction) { const origin = req.headers.origin; if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') { if (!origin || !origin.match(/^https:\/\/(www\.)?dreamledger\.org$/)) { if (req.path === '/health') return next(); return res.status(403).json({ error: 'Invalid origin' }); } } } next(); }
const loginLimiter = rateLimit({ windowMs:60*1000, max:5, message:{error:'Too many attempts'} });
const mutationLimiter = rateLimit({ windowMs:60*1000, max:60, keyGenerator:(req)=>req.cookies?.mtg_admin_token || ipKeyGenerator(req) });
const uploadLimiter = rateLimit({ windowMs:60*60*1000, max:20, keyGenerator:(req)=>req.cookies?.mtg_admin_token || ipKeyGenerator(req) });
const { generateToken, doubleCsrfProtection } = doubleCsrf({ getSecret: () => csrfSecret, getSessionIdentifier: (req) => req.cookies?.mtg_admin_token || req.ip, cookieName: 'mtg_csrf_token', cookieOptions: { httpOnly: false, signed: true, sameSite: 'strict', secure: isProduction, path: '/' }, size: 64, getTokenFromRequest: (req) => req.headers['x-csrf-token'] || req.body._csrf });
module.exports = { originGuard, loginLimiter, mutationLimiter, uploadLimiter, generateToken, doubleCsrfProtection };
'@ | Out-File -FilePath "silos/mtg/security.js" -Encoding utf8

# --- catalog.js ---
@'
const { db, PREFIX } = require('./database'); const path = require('path'); const fs = require('fs');
module.exports = function regenerateCatalog() { const mtgDir = path.join(__dirname, '..', '..', 'public', 'mtg'); if (!fs.existsSync(mtgDir)) fs.mkdirSync(mtgDir, { recursive: true }); const listings = db.prepare(`SELECT * FROM ${PREFIX}listings WHERE status = 'published' AND silo = 'mtg'`).all(); const catalog = listings.map(l => { let safeImage = ''; if (l.image_url) { try { const filename = path.basename(new URL(l.image_url, 'http://localhost').pathname); if (filename) safeImage = '/mtg-images/' + filename; } catch (e) {} } return { id: l.id, type: l.type, title: l.title, set_name: l.set_name, collector_number: l.collector_number, commander: l.commander, condition: l.condition, price_nzd: l.price_nzd, description: l.description, image: safeImage, purchase_url: l.purchase_url, published: true }; }); const catalogPath = path.join(mtgDir, 'catalog.json'); const tmpPath = catalogPath + '.tmp'; fs.writeFileSync(tmpPath, JSON.stringify(catalog, null, 2)); fs.renameSync(tmpPath, catalogPath); console.log('Catalog regenerated with', catalog.length, 'listings'); };
'@ | Out-File -FilePath "silos/mtg/catalog.js" -Encoding utf8

# --- routes.js ---
@'
const express = require('express'); const router = express.Router(); const multer = require('multer'); const { v4: uuidv4 } = require('uuid'); const path = require('path'); const fs = require('fs'); const FileType = require('file-type'); const { signToken, authMiddleware, verifyPassword, isProduction } = require('./auth'); const { db, init, PREFIX } = require('./database'); const { originGuard, loginLimiter, mutationLimiter, uploadLimiter, generateToken, doubleCsrfProtection } = require('./security'); const regenerateCatalog = require('./catalog'); let sharp; try { sharp = require('sharp'); } catch (e) {} const imgDir = process.env.RENDER === 'true' ? '/data/mtg-images' : path.join(__dirname, '..', '..', 'data', 'mtg-images'); if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir, { recursive: true }); const storage = multer.diskStorage({ destination: imgDir, filename: (req,file,cb) => cb(null, uuidv4() + '.upload') }); const upload = multer({ storage, limits: { fileSize:5*1024*1024 }, fileFilter: (req,file,cb) => cb(null,true) }); function logSecurity(event, req, severity='info', meta={}) { db.prepare(`INSERT INTO ${PREFIX}security_events (event, ip, user_agent, severity, metadata) VALUES (?,?,?,?,?)`).run(event, req.ip, req.headers['user-agent']||'', severity, JSON.stringify(meta)); } function logAdminAction(action, listingId, req) { const body = { ...req.body }; if (body.password) body.password = '[REDACTED]'; if (body._csrf) delete body._csrf; db.prepare(`INSERT INTO ${PREFIX}admin_actions (action, listing_id, ip, details) VALUES (?,?,?,?)`).run(action, listingId||null, req.ip, JSON.stringify(body)); } async function processUploadedImage(filePath) { const buf = fs.readFileSync(filePath); const type = await FileType.fromBuffer(buf); if (!type || !['image/jpeg','image/png','image/webp'].includes(type.mime)) { fs.unlinkSync(filePath); throw new Error('Invalid image'); } const ext = { 'image/jpeg':'jpg', 'image/png':'png', 'image/webp':'webp' }[type.mime]; const newName = uuidv4() + '.' + ext; const newPath = path.join(path.dirname(filePath), newName); if (sharp) { try { const pipeline = sharp(buf).resize(1200,1200,{fit:'inside'}); if (type.mime === 'image/png') pipeline.png({compressionLevel:9}); else if (type.mime === 'image/webp') pipeline.webp({quality:85}); else pipeline.jpeg({quality:85}); const resized = await pipeline.toBuffer(); fs.writeFileSync(newPath, resized); fs.unlinkSync(filePath); } catch (e) { fs.renameSync(filePath, newPath); } } else { fs.renameSync(filePath, newPath); } return newName; }
router.get('/health', (req,res) => { let dbOk=false, storageOk=false, catalogOk=false, migrationOk=false; try { dbOk = !!db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='${PREFIX}listings'`).get(); } catch(e){} try { db.prepare(`SELECT COUNT(*) AS c FROM ${PREFIX}migrations`).get(); migrationOk=true; } catch(e){} try { fs.accessSync(imgDir, fs.constants.W_OK); storageOk=true; } catch(e){} catalogOk = fs.existsSync(path.join(__dirname,'..','..','public','mtg','catalog.json')); let publishedCount = 0; try { publishedCount = db.prepare(`SELECT COUNT(*) AS c FROM ${PREFIX}listings WHERE status='published'`).get().c; } catch(e){} res.json({ ok: dbOk && storageOk && migrationOk && catalogOk, database:dbOk, storage:storageOk, catalog:catalogOk, migrations:migrationOk, publishedListings:publishedCount }); });
router.post('/login', originGuard, loginLimiter, async (req,res) => { if (typeof req.body.password !== 'string' || !req.body.password.trim()) return res.status(400).json({error:'Invalid request'}); const valid = await verifyPassword(req.body.password); if (!valid) { logSecurity('LOGIN_FAILURE', req, 'warn'); logAdminAction('LOGIN_FAILURE', null, req); return res.status(403).json({error:'Wrong password'}); } const sessionId = uuidv4(); db.prepare(`INSERT INTO ${PREFIX}admin_sessions (session_id, expires_at, ip, user_agent) VALUES (?, datetime('now','+1 hour'), ?, ?)`).run(sessionId, req.ip, req.headers['user-agent']||''); const token = signToken({ role:'admin', sessionId }); res.cookie('mtg_admin_token', token, { httpOnly:true, secure:isProduction, sameSite:'strict', maxAge:3600000, path:'/' }); logAdminAction('LOGIN_SUCCESS', null, req); res.json({ ok:true }); });
router.get('/csrf-token', authMiddleware, (req,res) => { const token = generateToken(req, res); res.json({ csrfToken: token }); });
router.use('/', authMiddleware, originGuard, mutationLimiter, doubleCsrfProtection);
router.post('/logout', (req,res) => { const token = req.cookies?.mtg_admin_token; if (token) { try { const payload = require('jsonwebtoken').verify(token, process.env.JWT_SECRET); if (payload.sessionId) db.prepare(`UPDATE ${PREFIX}admin_sessions SET revoked=1 WHERE session_id=?`).run(payload.sessionId); } catch(e){} } res.clearCookie('mtg_admin_token', { httpOnly:true, sameSite:'strict', secure:isProduction, path:'/' }); res.json({ ok:true }); });
router.post('/listings', upload.single('image'), uploadLimiter, async (req,res) => { try { let { type, title, set_name, collector_number, commander, condition, price_nzd, description, purchase_url, status } = req.body; if (!title || typeof title !== 'string' || !title.trim()) throw new Error('Title required'); if (title.length > 200) throw new Error('Title too long'); if (description && description.length > 5000) throw new Error('Description too long'); const price = Number(price_nzd); if (!Number.isFinite(price) || price < 0 || price > 100000) throw new Error('Invalid price'); if (purchase_url && !/^https?:\/\//.test(purchase_url)) throw new Error('Invalid URL'); const ALLOWED_COND = ['NM','LP','MP','HP']; const ALLOWED_STATUS = ['pending','draft','published','rejected']; if (!ALLOWED_COND.includes(condition)) condition = 'NM'; if (!ALLOWED_STATUS.includes(status)) status = 'pending'; type = (type === 'single') ? 'single' : 'deck'; let imageUrl = ''; if (req.file) { const newName = await processUploadedImage(req.file.path); imageUrl = '/mtg-images/' + newName; } const id = uuidv4(); const sku = 'MTG-' + Date.now(); db.prepare(`INSERT INTO ${PREFIX}listings (id, sku, silo, type, title, set_name, collector_number, commander, condition, price_nzd, description, image_url, purchase_url, status, owner_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, sku, 'mtg', type, title, set_name||null, collector_number||null, commander||'', condition, price, description||'', imageUrl, purchase_url||'', status, 'dreamledger'); if (status === 'published') regenerateCatalog(); logAdminAction('CREATE_LISTING', id, req); res.json({ id, ok:true }); } catch (e) { console.error(e); res.status(500).json({error:e.message}); } });
router.get('/listings', (req,res) => { res.json(db.prepare(`SELECT * FROM ${PREFIX}listings ORDER BY created_at DESC`).all()); });
router.put('/listings/:id', (req,res) => { try { const { status } = req.body; const ALLOWED = ['pending','draft','published','rejected']; if (!ALLOWED.includes(status)) throw new Error('Invalid status'); db.prepare(`UPDATE ${PREFIX}listings SET status = ? WHERE id = ?`).run(status, req.params.id); regenerateCatalog(); logAdminAction('UPDATE_STATUS', req.params.id, req); res.json({ ok:true }); } catch (e) { console.error(e); res.status(500).json({error:e.message}); } });
module.exports = router;
'@ | Out-File -FilePath "silos/mtg/routes.js" -Encoding utf8

# --- security-startup.js ---
@'
const fs = require('fs'); const path = require('path'); const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true'; const checks = []; function fail(m) { checks.push({status:'FAIL',msg:m}); console.error('[STARTUP SECURITY]', m); } function pass(m) { checks.push({status:'PASS',msg:m}); } if (isProduction) { if (!process.env.MTG_ADMIN_PASSWORD_HASH) fail('MTG_ADMIN_PASSWORD_HASH missing'); else pass('MTG_ADMIN_PASSWORD_HASH'); if (!process.env.JWT_SECRET) fail('JWT_SECRET missing'); else pass('JWT_SECRET'); if (!process.env.CSRF_SECRET) fail('CSRF_SECRET missing'); else pass('CSRF_SECRET'); if (!process.env.COOKIE_SECRET) fail('COOKIE_SECRET missing'); else pass('COOKIE_SECRET'); } else { pass('Not production – skipping env checks'); } const imgDir = process.env.RENDER === 'true' ? '/data/mtg-images' : path.join(__dirname, '..', '..', 'data', 'mtg-images'); const catDir = path.join(__dirname, '..', '..', 'public', 'mtg'); try { if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir, {recursive:true}); pass('Image dir writable'); } catch(e) { fail('Image dir not writable'); } try { if (!fs.existsSync(catDir)) fs.mkdirSync(catDir, {recursive:true}); pass('Catalog dir writable'); } catch(e) { fail('Catalog dir not writable'); } const logPath = path.join(__dirname, '..', '..', 'logs', 'security-startup-check.json'); if (!fs.existsSync(path.dirname(logPath))) fs.mkdirSync(path.dirname(logPath), {recursive:true}); fs.writeFileSync(logPath, JSON.stringify(checks, null, 2)); console.log('[STARTUP SECURITY] Check written to', logPath); if (isProduction && checks.some(c=>c.status==='FAIL')) { console.error('Security startup failures – exiting'); process.exit(1); }
'@ | Out-File -FilePath "silos/mtg/security-startup.js" -Encoding utf8

# ============================================================
# UI files
# ============================================================
Write-Host "🛍️  Writing UI..." -ForegroundColor Magenta

@'
<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DreamLedger MTG</title><style>body{font-family:-apple-system,sans-serif;background:#f8f8f8;padding:1rem;margin:0}h1{text-align:center}.carousel{display:flex;flex-wrap:wrap;gap:1.5rem;justify-content:center;padding:1rem 0}.card{background:#fff;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.1);overflow:hidden;width:220px;transition:transform 0.2s}.card:hover{transform:translateY(-4px)}.card img{width:100%;height:180px;object-fit:cover}.card-body{padding:.8rem}.card-body h3{margin:0;font-size:1.1rem}.type-badge{display:inline-block;background:#007aff;color:#fff;padding:.15rem .5rem;border-radius:1rem;font-size:.75rem;text-transform:uppercase;margin-bottom:.5rem}.condition{color:#666;font-size:.85rem}.price{font-size:1.2rem;font-weight:bold;color:#2e7d32;margin:.4rem 0}.buy-btn{display:block;width:100%;background:#007aff;color:#fff;border:none;padding:.6rem;border-radius:0 0 12px 12px;font-size:1rem;cursor:pointer}.buy-btn:hover{background:#005bb5}.empty{text-align:center;color:#888;padding:3rem}</style></head><body><h1>DreamLedger MTG</h1><div id="catalog" class="carousel"><div class="empty">Loading...</div></div><script>function e(s){const d=document.createElement('div');d.appendChild(document.createTextNode(s));return d.innerHTML}function safeUrl(u){try{const p=new URL(u);if(p.protocol==='http:'||p.protocol==='https:')return u}catch(e){}return'#'}(async()=>{try{const r=await fetch('/mtg/catalog.json');if(!r.ok)throw new Error('fail');const items=await r.json();const c=document.getElementById('catalog');if(!items.length){c.innerHTML='<div class="empty">No cards yet.</div>';return}c.innerHTML=items.map(i=>{const img=i.image?`<img src="${e(i.image)}" alt="${e(i.title)}">`:'';const link=safeUrl(i.purchase_url);return `<div class="card">${img}<div class="card-body"><span class="type-badge">${e(i.type)}</span><h3>${e(i.title)}</h3>${i.set_name?`<div>${e(i.set_name)} ${i.collector_number||''}</div>`:''}${i.commander?`<div>Commander: ${e(i.commander)}</div>`:''}<div class="condition">${e(i.condition)}</div><div class="price">$${i.price_nzd.toFixed(2)} NZD</div><p>${e(i.description||'')}</p></div><a href="${link}" target="_blank" rel="noopener"><button class="buy-btn">Buy / Enquire</button></a></div>`}).join('')}catch(err){document.getElementById('catalog').innerHTML='<div class="empty">Catalogue unavailable.</div>'}})()</script></body></html>
'@ | Out-File -FilePath "public/mtg/index.html" -Encoding utf8

@'
<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MTG Admin Login</title><link rel="stylesheet" href="style.css"></head><body class="login-page"><form id="loginForm"><h1>DreamLedger MTG</h1><input type="password" id="password" placeholder="Admin password" required><button type="submit">Log in</button><p id="error" style="color:red"></p></form><script>document.getElementById('loginForm').addEventListener('submit',async e=>{e.preventDefault();const pw=document.getElementById('password').value;const res=await fetch('/api/mtg/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:pw})});if(res.ok)window.location.href='/mtg-admin/index.html';else document.getElementById('error').textContent='Wrong password'});</script></body></html>
'@ | Out-File -FilePath "public/mtg-admin/login.html" -Encoding utf8

@'
<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MTG Admin</title><link rel="stylesheet" href="style.css"></head><body><nav><button data-tab="add">➕ Add Listing</button><button data-tab="pending">⏳ Pending</button><button data-tab="published">✅ Published</button><button id="logoutBtn">🚪 Logout</button></nav><div id="addTab" class="tab"><h2>New Listing</h2><select id="type"><option value="deck">Deck</option><option value="single">Single</option></select><br><textarea id="rawText" rows="5" placeholder="Paste listing info..."></textarea><input type="file" id="csvFile" accept=".csv"><br><input type="file" id="deckImage" accept="image/*" capture="environment"><br><button id="parseBtn">Parse & Preview</button><div id="preview" style="display:none;margin-top:1em"><input type="text" id="title" placeholder="Title"><br><div id="singleFields" style="display:none"><input type="text" id="set_name" placeholder="Set Name"><br><input type="text" id="collector_number" placeholder="Collector Number"><br></div><input type="text" id="commander" placeholder="Commander"><br><input type="number" id="price" placeholder="Price NZD"><br><select id="condition"><option>NM</option><option>LP</option><option>MP</option><option>HP</option></select><br><textarea id="description" rows="3" placeholder="Description"></textarea><br><input type="text" id="purchase_url" placeholder="Buy link"><br><button id="savePendingBtn">⏳ Save Pending</button><button id="saveDraftBtn">💾 Save Draft</button></div></div><div id="pendingTab" class="tab" style="display:none"><h2>Pending & Drafts</h2><div id="pendingList"></div></div><div id="publishedTab" class="tab" style="display:none"><h2>Published</h2><div id="publishedList"></div></div><script src="admin.js"></script></body></html>
'@ | Out-File -FilePath "public/mtg-admin/index.html" -Encoding utf8

@'
body{font-family:-apple-system,sans-serif;padding:.5rem;max-width:600px;margin:auto}nav{display:flex;flex-wrap:wrap;gap:.3rem;margin-bottom:1rem}nav button{flex:1;padding:.7rem;font-size:1rem;border:none;background:#007aff;color:#fff;border-radius:8px;cursor:pointer}input,textarea,select,button{width:100%;padding:.75rem;margin:.3rem 0;font-size:1rem;box-sizing:border-box}.card{background:#f5f5f5;padding:.8rem;border-radius:10px;margin-bottom:.5rem}.card img{max-width:80px;float:right}.actions{margin-top:.5rem;display:flex;gap:.3rem}.actions button{flex:1;font-size:.9rem;padding:.5rem}.login-page{display:flex;justify-content:center;align-items:center;height:100vh;margin:0}.login-page form{width:90%;max-width:350px}#preview{background:#fff;padding:1rem;border-radius:10px;border:1px solid #ddd}
'@ | Out-File -FilePath "public/mtg-admin/style.css" -Encoding utf8

@'
function escapeHtml(s){const d=document.createElement('div');d.appendChild(document.createTextNode(s));return d.innerHTML}let csrfToken='';let csrfReady=false;(async()=>{try{const r=await fetch('/api/mtg/csrf-token');if(r.ok){const d=await r.json();csrfToken=d.csrfToken;csrfReady=true}}catch(e){}})()let current={pending:[],published:[]}function showTab(t){document.querySelectorAll('.tab').forEach(tab=>tab.style.display='none');document.getElementById(t+'Tab').style.display='block';if(t==='pending')loadList('pending');if(t==='published')loadList('published')}document.addEventListener('click',e=>{const btn=e.target.closest('button[data-tab]');if(btn)showTab(btn.dataset.tab)})document.getElementById('type').addEventListener('change',function(){const s=this.value==='single';document.getElementById('singleFields').style.display=s?'block':'none';if(s)document.getElementById('commander').value=''})document.getElementById('parseBtn').addEventListener('click',()=>{const text=document.getElementById('rawText').value;const lines=text.split('\n').filter(l=>l.trim());const title=lines[0]||'';let commander='',price='',condition='NM';lines.forEach(l=>{if(l.toLowerCase().includes('commander:'))commander=l.split(':')[1]?.trim();const m=l.match(/\$?(\d+(?:\.\d{2})?)/);if(m)price=m[1];if(/\b(NM|LP|MP|HP)\b/i.test(l))condition=l.match(/NM|LP|MP|HP/i)[0].toUpperCase()});document.getElementById('title').value=title;document.getElementById('commander').value=commander;document.getElementById('price').value=price;document.getElementById('condition').value=condition;document.getElementById('description').value=lines.slice(1).join(' ');document.getElementById('preview').style.display='block'})async function saveListing(status){if(!csrfReady){alert('Token not ready');return}const fd=new FormData();fd.append('type',document.getElementById('type').value);fd.append('title',document.getElementById('title').value);fd.append('set_name',document.getElementById('set_name')?.value||'');fd.append('collector_number',document.getElementById('collector_number')?.value||'');fd.append('commander',document.getElementById('commander').value);fd.append('price_nzd',document.getElementById('price').value);fd.append('condition',document.getElementById('condition').value);fd.append('description',document.getElementById('description').value);fd.append('purchase_url',document.getElementById('purchase_url').value);fd.append('status',status);fd.append('_csrf',csrfToken);const img=document.getElementById('deckImage').files[0];if(img)fd.append('image',img);const res=await fetch('/api/mtg/listings',{method:'POST',body:fd,headers:{'x-csrf-token':csrfToken}});if(res.ok){alert('Saved');document.getElementById('preview').style.display='none';document.getElementById('rawText').value='';document.getElementById('deckImage').value='';loadList('pending')}else alert('Save failed')}document.getElementById('savePendingBtn').addEventListener('click',()=>saveListing('pending'))document.getElementById('saveDraftBtn').addEventListener('click',()=>saveListing('draft'))async function loadList(filter){const res=await fetch('/api/mtg/listings');const listings=await res.json();if(filter==='pending')current.pending=listings.filter(l=>l.status==='pending'||l.status==='draft');else current.published=listings.filter(l=>l.status==='published');renderLists()}function renderList(id,items){const container=document.getElementById(id);if(!items.length){container.innerHTML='<p>No listings.</p>';return}container.innerHTML=items.map(l=>`<div class="card">${l.image_url?`<img src="${escapeHtml(l.image_url)}">`:''}<strong>${escapeHtml(l.title)}</strong> (${escapeHtml(l.type)})<br>${l.set_name?'Set: '+escapeHtml(l.set_name):''} ${l.collector_number?'#'+l.collector_number:''}<br>${l.commander?'Commander: '+escapeHtml(l.commander):''}<br>Price: $${l.price_nzd}<br>Condition: ${escapeHtml(l.condition)}<div class="actions">${id==='pendingList'?`<button class="approve-btn" data-id="${escapeHtml(l.id)}">🚀 Approve</button><button class="reject-btn" data-id="${escapeHtml(l.id)}">❌ Reject</button>`:`<button class="unpublish-btn" data-id="${escapeHtml(l.id)}">⬅ Unpublish</button>`}</div></div>`).join('')}function renderLists(){renderList('pendingList',current.pending);renderList('publishedList',current.published)}document.addEventListener('click',async e=>{const btn=e.target.closest('button');if(!btn)return;const id=btn.dataset.id;if(btn.classList.contains('approve-btn'))await updateStatus(id,'published');else if(btn.classList.contains('reject-btn'))await updateStatus(id,'rejected');else if(btn.classList.contains('unpublish-btn'))await updateStatus(id,'draft')})async function updateStatus(id,status){await fetch(`/api/mtg/listings/${id}`,{method:'PUT',headers:{'Content-Type':'application/json','x-csrf-token':csrfToken},body:JSON.stringify({status,_csrf:csrfToken})});await loadList('pending');await loadList('published')}document.getElementById('csvFile').addEventListener('change',e=>{if(e.target.files[0])handleCSV(e.target.files[0])})function parseCSVLine(t){const r=[];let cur='',q=false;for(let c of t){if(c==='"'){q=!q;continue}if(c===','&&!q){r.push(cur.trim());cur='';continue}if(c==='\n'&&!q){r.push(cur.trim());cur='';continue}cur+=c}r.push(cur.trim());return r}function handleCSV(file){const reader=new FileReader();reader.onload=e=>{const text=e.target.result;const lines=text.split('\n').filter(l=>l.trim());if(!lines.length)return;const headers=parseCSVLine(lines[0]).map(h=>h.toLowerCase().replace(/"/g,''));const listings=[];for(let i=1;i<lines.length;i++){const cols=parseCSVLine(lines[i]);if(cols.length<1)continue;const obj={};headers.forEach((h,idx)=>obj[h]=(cols[idx]||'').replace(/^"|"$/g,''));obj.price_nzd=obj.price_nzd||obj.price||'';obj.condition=obj.condition||'NM';obj.title=obj.title||obj.name||'';obj.type=obj.type||'deck';if(!obj.title.trim())continue;listings.push(obj)}if(!listings.length){alert('No valid listings');return}showBulk(listings)};reader.readAsText(file)}function showBulk(listings){const preview=document.getElementById('preview');preview.innerHTML='<h3>CSV Import</h3>';listings.forEach((l,i)=>{preview.innerHTML+=`<div><input type="checkbox" id="csv_${i}" checked> ${escapeHtml(l.title)} (${escapeHtml(l.type)}) - $${l.price_nzd}</div>`});preview.innerHTML+='<button id="saveBulkBtn">Save selected</button>';preview.style.display='block';window.bulk=listings;document.getElementById('saveBulkBtn').addEventListener('click',saveBulk)}async function saveBulk(){if(!csrfReady){alert('CSRF not ready');return}const sel=window.bulk.filter((l,i)=>document.getElementById(`csv_${i}`).checked);for(const l of sel){const fd=new FormData();fd.append('type',l.type||'deck');fd.append('title',l.title);fd.append('set_name',l.set_name||'');fd.append('collector_number',l.collector_number||'');fd.append('commander',l.commander||'');fd.append('price_nzd',l.price_nzd||'0');fd.append('condition',l.condition||'NM');fd.append('description',l.description||'');fd.append('purchase_url',l.purchase_url||'');fd.append('status','pending');fd.append('_csrf',csrfToken);await fetch('/api/mtg/listings',{method:'POST',body:fd,headers:{'x-csrf-token':csrfToken}})}alert('Imported');loadList('pending')}document.getElementById('logoutBtn').addEventListener('click',async()=>{await fetch('/api/mtg/logout',{method:'POST',headers:{'x-csrf-token':csrfToken}});window.location.href='/mtg-admin/login.html'})showTab('add');loadList('pending');loadList('published')
'@ | Out-File -FilePath "public/mtg-admin/admin.js" -Encoding utf8

# ============================================================
# Server integration
# ============================================================
Write-Host "⚙️  Integrating server.js..." -ForegroundColor Cyan
if (Test-Path "server.js") { Copy-Item "server.js" "$backupDir/server.js" -Force }

$mtgBlock = @'

// ===== DREAMLEDGER_MTG_BEGIN =====
require('./silos/mtg/security-startup');
async function bootMTG() {
  const { init } = require('./silos/mtg/database'); await init();
  const mtgRoutes = require('./silos/mtg/routes'); app.use('/api/mtg', mtgRoutes);
  app.use('/mtg-images', express.static(process.env.RENDER === 'true' ? '/data/mtg-images' : path.join(__dirname, 'data', 'mtg-images'), { maxAge: '7d' }));
  app.use('/mtg-admin/login.html', express.static(path.join(__dirname, 'public', 'mtg-admin', 'login.html')));
  app.use('/mtg-admin/style.css', express.static(path.join(__dirname, 'public', 'mtg-admin', 'style.css')));
  app.get('/mtg-admin/login.html', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'mtg-admin', 'login.html')); });
  app.get('/mtg-admin', (req, res) => res.redirect('/mtg-admin/login.html'));
  const { authMiddleware } = require('./silos/mtg/auth'); app.use('/mtg-admin', authMiddleware);
  app.use('/mtg-admin', express.static(path.join(__dirname, 'public', 'mtg-admin'), { setHeaders(res, filePath) { if (filePath.endsWith('admin.js')) res.setHeader('Cache-Control', 'no-store'); } }));
  app.use('/mtg', express.static(path.join(__dirname, 'public', 'mtg'))); return Promise.resolve();
}
bootMTG().then(() => { const PORT = process.env.PORT || 3000; app.listen(PORT, () => console.log('DreamLedger running on port ' + PORT)); }).catch(err => { console.error('Failed to boot MTG:', err); process.exit(1); });
// ===== DREAMLEDGER_MTG_END =====

'@

$freshServer = @'
const express = require('express'); const path = require('path'); const helmet = require('helmet'); const app = express();
app.set('trust proxy', 1); app.use(helmet()); app.use(express.json({ limit: '100kb' })); app.use(express.urlencoded({ extended: true, limit: '100kb' }));
const cookieParser = require('cookie-parser'); app.use(cookieParser(process.env.COOKIE_SECRET || (() => { throw new Error('COOKIE_SECRET missing'); })()));
// MTG block inserted by bootstrap
app.use(express.static(path.join(__dirname, 'public')));
app.use((err, req, res, next) => { if (err.code === 'EBADCSRFTOKEN') return res.status(403).json({ error: 'Invalid CSRF token' }); if (err instanceof require('multer').MulterError) return res.status(400).json({ error: err.message }); if (err) { console.error(err); return res.status(500).json({ error: 'Internal server error' }); } next(); });
'@

if (-not (Test-Path "server.js")) {
    ($freshServer -replace "// MTG block inserted by bootstrap", $mtgBlock.Trim()) + @"

const PORT = process.env.PORT || 3000; app.listen(PORT, () => console.log('DreamLedger running on port ' + PORT));
"@ | Out-File -FilePath "server.js" -Encoding utf8
    Write-Host "   Created fresh server.js" -ForegroundColor Green
} else {
    $content = Get-Content "server.js" -Raw
    if ($content -match "app\.use\(cookieParser\(\s*\)") { $content = $content -replace "app\.use\(cookieParser\(\s*\)", "app.use(cookieParser(process.env.COOKIE_SECRET || (() => { throw new Error('COOKIE_SECRET missing'); })())" }
    elseif ($content -notmatch "cookieParser\(process\.env\.COOKIE_SECRET") { throw "cookieParser signing could not be verified." }
    if ($content -match "// ===== DREAMLEDGER_MTG_BEGIN =====") { $content = $content -replace "(?s)// ===== DREAMLEDGER_MTG_BEGIN =====.*// ===== DREAMLEDGER_MTG_END =====", $mtgBlock.Trim() }
    else { $pos = $content.IndexOf("app.use(cookieParser"); if ($pos -ge 0) { $endOfLine = $content.IndexOf("`n", $pos); $content = $content.Insert($endOfLine + 1, "`n$mtgBlock`n") } else { $content = $mtgBlock + "`n" + $content } }
    $content | Out-File -FilePath "server.js" -Encoding utf8
    Write-Host "   Patched existing server.js" -ForegroundColor Green
}

# ============================================================
# Syntax check & smoke test
# ============================================================
Write-Host "🔍 Checking syntax..." -ForegroundColor Yellow
node --check server.js; if ($LASTEXITCODE -ne 0) { throw "server.js syntax error" }
Write-Host "   ✅ Syntax OK" -ForegroundColor Green

Write-Host "🔥 Smoke test..." -ForegroundColor Magenta
$oldEnv = @{}
@('NODE_ENV','JWT_SECRET','CSRF_SECRET','COOKIE_SECRET','MTG_ADMIN_PASSWORD_HASH','PORT') | ForEach-Object { $oldEnv[$_] = Get-Item -Path Env:\$_ -ErrorAction SilentlyContinue }
$testResults = @{}
try {
    $env:NODE_ENV = "production"; $env:JWT_SECRET = "test-jwt"; $env:CSRF_SECRET = "test-csrf"; $env:COOKIE_SECRET = "test-cookie"
    $env:MTG_ADMIN_PASSWORD_HASH = node -e "console.log(require('bcryptjs').hashSync('test',12))"; $env:PORT = 3001
    $server = Start-Process -NoNewWindow -PassThru -FilePath "node" -ArgumentList "server.js"; Start-Sleep 5
    $base = "http://localhost:$env:PORT"

    $health = Invoke-RestMethod "$base/api/mtg/health"; $testResults.health = if ($health.ok) { "PASS" } else { "FAIL" }; if ($testResults.health -eq "FAIL") { throw "Health check failed" }
    Write-Host "   ✅ Health OK" -ForegroundColor Green

    $loginRes = Invoke-WebRequest -Uri "$base/api/mtg/login" -Method POST -Body '{"password":"test"}' -ContentType "application/json" -SessionVariable sess
    $authToken = ($sess.Cookies.GetCookies($base) | Where-Object { $_.Name -eq 'mtg_admin_token' }).Value
    $testResults.login = if ($authToken) { "PASS" } else { "FAIL" }; if ($testResults.login -eq "FAIL") { throw "Login failed" }
    Write-Host "   ✅ Login OK" -ForegroundColor Green

    try { Invoke-WebRequest -Uri "$base/api/mtg/listings" -Method POST -Body @{title='FAIL'} -WebSession $sess -ErrorAction Stop; $testResults.csrfReject = "FAIL"; throw "CSRF bypass" } catch [System.Net.WebException] { $testResults.csrfReject = "PASS" }
    Write-Host "   ✅ CSRF rejection works" -ForegroundColor Green

    $csrfRes = Invoke-RestMethod -Uri "$base/api/mtg/csrf-token" -WebSession $sess; $csrfToken = $csrfRes.csrfToken
    $testResults.csrfToken = if ($csrfToken) { "PASS" } else { "FAIL" }; if ($testResults.csrfToken -eq "FAIL") { throw "CSRF token missing" }
    Write-Host "   ✅ CSRF token obtained" -ForegroundColor Green

    $imgFile = New-TemporaryFile; $jpg = [System.Convert]::FromBase64String("/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYI0RVNk/2Q1JTVFVWV2hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iiigD//2Q==")
    [System.IO.File]::WriteAllBytes($imgFile, $jpg)
    $testTitle = "PRODUCTION-SEAL-$((Get-Random))"
    $client = New-Object System.Net.Http.HttpClient; $content = New-Object System.Net.Http.MultipartFormDataContent
    $content.Add((New-Object System.Net.Http.StringContent "deck"), "type"); $content.Add((New-Object System.Net.Http.StringContent $testTitle), "title")
    $content.Add((New-Object System.Net.Http.StringContent "10"), "price_nzd"); $content.Add((New-Object System.Net.Http.StringContent "NM"), "condition")
    $content.Add((New-Object System.Net.Http.StringContent "published"), "status")
    $fileContent = New-Object System.Net.Http.ByteArrayContent ([System.IO.File]::ReadAllBytes($imgFile))
    $fileContent.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse("image/jpeg"); $content.Add($fileContent, "image", "test.jpg")
    $client.DefaultRequestHeaders.Add("Cookie", "mtg_admin_token=$authToken"); $client.DefaultRequestHeaders.Add("x-csrf-token", $csrfToken)
    $uploadResult = $client.PostAsync("$base/api/mtg/listings", $content).Result
    $testResults.upload = if ($uploadResult.StatusCode -eq 200) { "PASS" } else { "FAIL" }; if ($testResults.upload -eq "FAIL") { throw "Create listing failed" }
    Write-Host "   ✅ Listing created & published" -ForegroundColor Green; Remove-Item $imgFile

    Start-Sleep 1; $catalog = Invoke-RestMethod "$base/mtg/catalog.json"; $testItem = $catalog | Where-Object { $_.title -eq $testTitle }
    $testResults.catalog = if ($testItem) { "PASS" } else { "FAIL" }; if ($testResults.catalog -eq "FAIL") { throw "Catalog missing test listing" }
    Write-Host "   ✅ Catalog OK" -ForegroundColor Green

    $listings = Invoke-RestMethod "$base/api/mtg/listings" -WebSession $sess; $testId = ($listings | Where-Object { $_.title -eq $testTitle }).id
    if ($testId) { $body = @{ status='rejected'; _csrf=$csrfToken } | ConvertTo-Json; Invoke-WebRequest -Uri "$base/api/mtg/listings/$testId" -Method PUT -Body $body -ContentType "application/json" -WebSession $sess -Headers @{'x-csrf-token'=$csrfToken} }
} catch { Write-Host "   ❌ Smoke test failed: $_" -ForegroundColor Red; throw } finally { if ($server) { $server.Kill() }; foreach ($key in $oldEnv.Keys) { if ($oldEnv[$key]) { Set-Item -Path "Env:$key" -Value $oldEnv[$key].Value } else { Remove-Item -Path "Env:$key" -ErrorAction SilentlyContinue } } }

# ============================================================
# Proof artifact
# ============================================================
Write-Host "📜 Deployment proof..." -ForegroundColor Cyan
$proof = @{ silo = "mtg"; version = "1.0"; timestamp = (Get-Date -Format "yyyy-MM-ddTHH:mm:ss"); backup = $backupDir; nodeVersion = node --version; tests = $testResults; result = if ($testResults.Values -contains "FAIL") { "FAIL" } else { "PASS" } } | ConvertTo-Json -Depth 4
$proof | Out-File -FilePath "logs/silo-bootstrap-proof-mtg.json" -Encoding utf8
Write-Host "   Proof: logs/silo-bootstrap-proof-mtg.json" -ForegroundColor Green

Write-Host "`n✅ DreamLedger MTG Silo v1.0 – PRODUCTION SEAL PASSED" -ForegroundColor Green
Write-Host "   Start: node server.js"
Write-Host "   Next: Deploy your next silo by feeding a manifest to New-Silo.ps1"