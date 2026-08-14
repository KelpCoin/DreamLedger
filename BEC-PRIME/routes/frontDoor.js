'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const DATA = process.env.DREAMIEZ_DATA_DIR || ((fs.existsSync('/var/data') && fs.statSync('/var/data').isDirectory()) ? '/var/data/dreamiez' : path.join(ROOT, 'data', 'dreamiez'));
const USERS = path.join(DATA, 'users.json');
const LISTINGS = path.join(DATA, 'marketplace-listings.json');
const MEDIA = path.join(DATA, 'media');
const AVATARS = path.join(MEDIA, 'avatars');
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const PUBLIC_BASE = (process.env.PUBLIC_BASE_URL || 'https://dreamledger.org').replace(/\/$/, '');

function read(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function write(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp-' + process.pid + '-' + Date.now();
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n');
  fs.renameSync(tmp, file);
}
function json(res, status, data) {
  if (res.writableEnded) return true;
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
  return true;
}
function cookie(req, name) {
  const m = String(req.headers.cookie || '').match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return m ? decodeURIComponent(m[1]) : null;
}
function sessionUser(req) {
  const id = cookie(req, 'dreamiez_session') || cookie(req, 'dreamiez_id');
  if (!id) return null;
  return read(USERS, []).find(u => u.id === id) || null;
}
function setSession(res, id) {
  res.setHeader('Set-Cookie', 'dreamiez_session=' + encodeURIComponent(id) + '; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax');
}
function clearSession(res) {
  res.setHeader('Set-Cookie', 'dreamiez_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax');
}
function body(req) {
  return new Promise((resolve, reject) => {
    let s = '';
    req.on('data', chunk => { s += chunk; if (s.length > 12000000) req.destroy(); });
    req.on('end', () => { try { resolve(s ? JSON.parse(s) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}
function escapeHtml(s) {
  return String(s).replace(/[&<>\"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#39;' }[c]));
}
function publicAccount(u) {
  return {
    account_id: u.id,
    name: u.name || 'Dreamer',
    email: u.email || null,
    email_verified: u.email_verified === true,
    avatar: u.avatar || { height: 2, build: 2, skin: 5 },
    avatar_style: u.avatar_style || 'dream',
    avatar_photo: u.avatar_photo || null,
    seller: u.seller || { enabled: false, display_name: u.name || 'Dreamer', location: '', bio: '' },
    cosmetics: u.cosmetics || [],
    streak: u.streak || 0
  };
}
function listingPublic(x) {
  return {
    id: x.id,
    seller_id: x.seller_id,
    seller_name: x.seller_name,
    seller_profile: x.seller_profile || null,
    title: x.title,
    description: x.description,
    category: x.category,
    price: x.price,
    currency: x.currency,
    condition: x.condition,
    location: x.location,
    photos: x.photos || [],
    status: x.status,
    checkout_available: x.status === 'APPROVED' && x.checkout_available !== false,
    created_at: x.created_at,
    car: x.car || null
  };
}
function verifiedSeller(u) { return Boolean(u && u.email && u.email_verified === true); }
function sellerProfile(u) {
  return u && u.seller ? u.seller : { enabled: false, display_name: u?.name || 'Dreamer', location: '', bio: '' };
}
async function stripeCheckout(listing) {
  if (!STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY is not configured');
  const params = new URLSearchParams();
  params.set('mode', 'payment');
  params.set('line_items[0][price_data][currency]', 'nzd');
  params.set('line_items[0][price_data][unit_amount]', String(Math.round(Number(listing.price) * 100)));
  params.set('line_items[0][price_data][product_data][name]', listing.title);
  params.set('line_items[0][price_data][product_data][description]', listing.description.slice(0, 450));
  params.set('line_items[0][quantity]', '1');
  params.set('metadata[listing_id]', listing.id);
  params.set('metadata[seller_id]', listing.seller_id);
  params.set('metadata[silo]', listing.category);
  params.set('success_url', PUBLIC_BASE + '/checkout/success?session_id={CHECKOUT_SESSION_ID}');
  params.set('cancel_url', PUBLIC_BASE + '/listing.html?id=' + encodeURIComponent(listing.id));
  const r = await fetch('https://api.stripe.com/v1/checkout/sessions', { method: 'POST', headers: { Authorization: 'Bearer ' + STRIPE_SECRET_KEY, 'Content-Type': 'application/x-www-form-urlencoded' }, body: params });
  const text = await r.text();
  let data; try { data = JSON.parse(text); } catch { data = {}; }
  if (!r.ok) throw new Error(data?.error?.message || 'Stripe checkout creation failed');
  return data;
}

async function handle(req, res, url) {
  url = String(url || req.url || '').split('?')[0];
  if (!url.startsWith('/api/account') && !url.startsWith('/api/marketplace') && !url.startsWith('/api/dreamiez/avatar-photo')) return false;

  if (req.method === 'GET' && url === '/api/account/me') {
    const u = sessionUser(req);
    return json(res, 200, { authenticated: Boolean(u), account: u ? publicAccount(u) : null });
  }
  if (req.method === 'POST' && url === '/api/account/update') {
    const u = sessionUser(req); if (!u) return json(res, 401, { error: 'login required' });
    const b = await body(req); const users = read(USERS, []); const stored = users.find(x => x.id === u.id);
    stored.name = String(b.name || stored.name || 'Dreamer').trim().slice(0, 60) || 'Dreamer';
    stored.seller = stored.seller || {};
    stored.seller.display_name = String(b.seller_display_name || stored.seller.display_name || stored.name).trim().slice(0, 80);
    stored.seller.location = String(b.location || stored.seller.location || '').trim().slice(0, 100);
    stored.seller.bio = String(b.bio || stored.seller.bio || '').trim().slice(0, 500);
    stored.seller.enabled = verifiedSeller(stored);
    write(USERS, users); return json(res, 200, { ok: true, account: publicAccount(stored) });
  }
  if (req.method === 'POST' && url === '/api/account/logout') { clearSession(res); return json(res, 200, { ok: true }); }
  if (req.method === 'POST' && url === '/api/account/password-reset/request') {
    const b = await body(req); const email = String(b.email || '').trim().toLowerCase(); const users = read(USERS, []); const u = users.find(x => x.email === email);
    if (!u) return json(res, 200, { ok: true, message: 'If that account exists, a reset link has been issued.' });
    u.password_reset_token = crypto.randomBytes(32).toString('hex'); u.password_reset_expires = new Date(Date.now() + 3600000).toISOString(); write(USERS, users);
    const resetUrl = PUBLIC_BASE + '/reset-password.html?token=' + encodeURIComponent(u.password_reset_token);
    if (process.env.DREAMIEZ_SMOKE === 'true') return json(res, 200, { ok: true, reset_url: resetUrl });
    return json(res, 200, { ok: true, message: 'Reset token created. Email delivery can be connected to the same transactional email provider.' });
  }
  if (req.method === 'POST' && url === '/api/account/password-reset/confirm') {
    const b = await body(req); const token = String(b.token || ''); const password = String(b.password || ''); if (password.length < 8) return json(res, 422, { error: 'password must be at least 8 characters' });
    const users = read(USERS, []); const u = users.find(x => x.password_reset_token === token); if (!u || !u.password_reset_expires || Date.parse(u.password_reset_expires) < Date.now()) return json(res, 400, { error: 'reset link is invalid or expired' });
    const salt = crypto.randomBytes(16).toString('hex'); u.password = { salt, hash: crypto.scryptSync(password, salt, 64).toString('hex') }; u.password_reset_token = null; u.password_reset_expires = null; write(USERS, users); setSession(res, u.id); return json(res, 200, { ok: true, account: publicAccount(u) });
  }
  if (req.method === 'POST' && url === '/api/dreamiez/avatar-photo') {
    const u = sessionUser(req); if (!u) return json(res, 401, { error: 'login required' }); if (!verifiedSeller(u) && !u.email) return json(res, 403, { error: 'account required' });
    const b = await body(req); const mime = String(b.mime || '').toLowerCase(); const data = String(b.data || ''); if (!/^image\/(jpeg|png|webp)$/.test(mime) || !data) return json(res, 422, { error: 'JPEG, PNG or WebP image required' });
    const raw = data.replace(/^data:[^;]+;base64,/, ''); if (raw.length > 8 * 1024 * 1024) return json(res, 413, { error: 'image too large' });
    const id = 'avatar_' + crypto.randomBytes(8).toString('hex'); const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg'; fs.mkdirSync(AVATARS, { recursive: true }); fs.writeFileSync(path.join(AVATARS, id + '.' + ext), Buffer.from(raw, 'base64'));
    const users = read(USERS, []); const stored = users.find(x => x.id === u.id); stored.avatar_photo = '/api/dreamiez/avatar-photo/' + id; write(USERS, users); return json(res, 201, { ok: true, url: stored.avatar_photo, account: publicAccount(stored) });
  }
  if (req.method === 'GET' && url.startsWith('/api/dreamiez/avatar-photo/')) {
    const id = url.slice('/api/dreamiez/avatar-photo/'.length); const files = fs.existsSync(AVATARS) ? fs.readdirSync(AVATARS).filter(x => x.startsWith(id + '.')) : []; if (!files.length) return json(res, 404, { error: 'avatar photo not found' });
    const file = path.join(AVATARS, files[0]); const ext = path.extname(file).toLowerCase(); const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg'; res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'public,max-age=31536000,immutable' }); res.end(fs.readFileSync(file)); return true;
  }

  if (req.method === 'GET' && url === '/api/marketplace/catalog') {
    const items = read(LISTINGS, []).filter(x => x.status === 'APPROVED').map(listingPublic); return json(res, 200, { items });
  }
  if (req.method === 'GET' && url === '/api/marketplace/listings') {
    const q = String((req.url.split('?')[1] || '')); const params = new URLSearchParams(q); const search = String(params.get('q') || '').toLowerCase(); const category = String(params.get('category') || '').toLowerCase(); const min = Number(params.get('min') || 0); const max = Number(params.get('max') || Number.MAX_SAFE_INTEGER); const location = String(params.get('location') || '').toLowerCase(); const sort = params.get('sort') || 'newest';
    let items = read(LISTINGS, []).filter(x => x.status === 'APPROVED').filter(x => !search || (x.title + ' ' + x.description).toLowerCase().includes(search)).filter(x => !category || String(x.category).toLowerCase() === category).filter(x => Number(x.price) >= min && Number(x.price) <= max).filter(x => !location || String(x.location).toLowerCase().includes(location));
    items.sort((a,b) => sort === 'price_asc' ? a.price-b.price : sort === 'price_desc' ? b.price-a.price : new Date(b.created_at)-new Date(a.created_at)); return json(res, 200, { items: items.map(listingPublic) });
  }
  if (req.method === 'GET' && /^\/api\/marketplace\/listings\/[^/]+$/.test(url)) {
    const id = url.split('/').pop(); const item = read(LISTINGS, []).find(x => x.id === id && x.status === 'APPROVED'); if (!item) return json(res, 404, { error: 'listing not found' });
    const seller = read(USERS, []).find(x => x.id === item.seller_id); return json(res, 200, { item: listingPublic({ ...item, seller_profile: seller ? sellerProfile(seller) : null }) });
  }
  if (req.method === 'GET' && /^\/api\/marketplace\/sellers\/[^/]+$/.test(url)) {
    const id = url.split('/').pop(); const users = read(USERS, []); const seller = users.find(x => x.id === id); if (!seller) return json(res, 404, { error: 'seller not found' });
    const listings = read(LISTINGS, []).filter(x => x.seller_id === id && x.status === 'APPROVED').map(listingPublic); return json(res, 200, { seller: { id: seller.id, ...sellerProfile(seller) }, listings });
  }
  if (req.method === 'POST' && url === '/api/marketplace/listings') {
    const u = sessionUser(req); if (!verifiedSeller(u)) return json(res, 403, { error: 'verified account required before selling' }); const b = await body(req);
    const title = String(b.title || '').trim().slice(0,100), description = String(b.description || '').trim().slice(0,3000), category = String(b.category || 'Marketplace').trim().slice(0,40), condition = String(b.condition || '').trim().slice(0,40), location = String(b.location || '').trim().slice(0,100), price = Number(b.price);
    if (!title || !description || !Number.isFinite(price) || price <= 0) return json(res, 422, { error: 'title, description and positive price are required' });
    const photos = Array.isArray(b.photos) ? b.photos.slice(0,12) : []; if (!photos.length) return json(res, 422, { error: 'at least one real photo is required' });
    let car = null; if (category.toLowerCase() === 'cars') { const c = b.car || {}; car = { make:String(c.make||'').trim().slice(0,50), model:String(c.model||'').trim().slice(0,50), year:Number(c.year)||null, kilometres:Number(c.kilometres)||null, wof_expiry:String(c.wof_expiry||'').slice(0,20), rego_expiry:String(c.rego_expiry||'').slice(0,20), transmission:String(c.transmission||'').slice(0,30), fuel_type:String(c.fuel_type||'').slice(0,30), body_type:String(c.body_type||'').slice(0,30), service_history:String(c.service_history||'').slice(0,1000), accident_history:String(c.accident_history||'').slice(0,1000), vin_private:String(c.vin_private||'').slice(0,80) }; if (!car.make || !car.model || !car.year || !car.kilometres) return json(res, 422, { error: 'cars require make, model, year and kilometres' }); }
    const listings = read(LISTINGS, []); const item = { id:'lst_'+crypto.randomBytes(8).toString('hex'), seller_id:u.id, seller_name:sellerProfile(u).display_name || u.name || 'Dreamer', seller_profile:sellerProfile(u), title, description, category, condition, location, price:Math.round(price*100)/100, currency:'NZD', status:'APPROVED', checkout_available:true, photos, car, created_at:new Date().toISOString() }; listings.push(item); write(LISTINGS, listings); return json(res, 201, { ok:true, item:listingPublic(item), message:'Listing is live.' });
  }
  if (req.method === 'POST' && url === '/api/marketplace/media') {
    const u = sessionUser(req); if (!verifiedSeller(u)) return json(res, 403, { error: 'verified account required' }); const b = await body(req); const mime = String(b.mime || '').toLowerCase(), data = String(b.data || ''); if (!/^image\/(jpeg|png|webp)$/.test(mime) || !data) return json(res, 422, { error:'JPEG, PNG or WebP image required' }); const raw = data.replace(/^data:[^;]+;base64,/, ''); if (raw.length > 8*1024*1024) return json(res, 413, { error:'image too large' }); const id='img_'+crypto.randomBytes(8).toString('hex'), ext=mime==='image/png'?'png':mime==='image/webp'?'webp':'jpg'; fs.mkdirSync(MEDIA,{recursive:true}); fs.writeFileSync(path.join(MEDIA,id+'.'+ext),Buffer.from(raw,'base64')); return json(res,201,{ok:true,id,url:'/api/marketplace/media/'+id});
  }
  if (req.method === 'GET' && url.startsWith('/api/marketplace/media/')) { const id=url.slice('/api/marketplace/media/'.length); const files=fs.existsSync(MEDIA)?fs.readdirSync(MEDIA).filter(x=>x.startsWith(id+'.')):[]; if(!files.length)return json(res,404,{error:'media not found'}); const file=path.join(MEDIA,files[0]),ext=path.extname(file).toLowerCase(),mime=ext==='.png'?'image/png':ext==='.webp'?'image/webp':'image/jpeg'; res.writeHead(200,{'Content-Type':mime,'Cache-Control':'public,max-age=31536000,immutable'}); res.end(fs.readFileSync(file)); return true; }
  if (req.method === 'POST' && /^\/api\/marketplace\/listings\/[^/]+\/checkout$/.test(url)) { const id=url.split('/')[4]; const item=read(LISTINGS,[]).find(x=>x.id===id&&x.status==='APPROVED'&&x.checkout_available!==false); if(!item)return json(res,404,{error:'listing not available'}); try{const session=await stripeCheckout(item);return json(res,200,{ok:true,listing_id:item.id,session_id:session.id,checkout_url:session.url});}catch(e){return json(res,502,{error:e.message});} }
  return false;
}
module.exports = { handle };
