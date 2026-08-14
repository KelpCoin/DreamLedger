'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const DigitalProxyAssistant = require('../proxy/DigitalProxyAssistant');

const ROOT = path.join(__dirname, '..');
const DATA = process.env.DREAMIEZ_DATA_DIR || ((fs.existsSync('/var/data') && fs.statSync('/var/data').isDirectory()) ? '/var/data/dreamiez' : path.join(ROOT, 'data', 'dreamiez'));
const USERS = path.join(DATA, 'users.json');
const CONVERSATIONS = path.join(DATA, 'conversations.json');
const MESSAGES = path.join(DATA, 'messages.json');

function read(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function write(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp-' + process.pid + '-' + Date.now();
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n');
  fs.renameSync(tmp, file);
}
function cookie(req, name) {
  const m = String(req.headers.cookie || '').match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return m ? decodeURIComponent(m[1]) : null;
}
function currentUser(req) {
  const id = cookie(req, 'dreamiez_session') || cookie(req, 'dreamiez_id');
  if (!id) return null;
  return read(USERS, []).find(u => u.id === id) || null;
}
function json(res, status, data) {
  if (res.writableEnded) return true;
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
  return true;
}
function body(req) {
  return new Promise((resolve, reject) => {
    let s = '';
    req.on('data', chunk => { s += chunk; if (s.length > 200000) req.destroy(); });
    req.on('end', () => { try { resolve(s ? JSON.parse(s) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}
function id(prefix) { return prefix + '_' + crypto.randomBytes(12).toString('hex'); }
function ownedConversation(userId, conversationId) {
  return read(CONVERSATIONS, []).find(c => c.id === conversationId && c.user_id === userId) || null;
}
function publicConversation(c) {
  return { id: c.id, user_id: c.user_id, title: c.title, created_at: c.created_at, updated_at: c.updated_at, message_count: Number(c.message_count || 0) };
}
function publicMessage(m) {
  return { id: m.id, conversation_id: m.conversation_id, role: m.role, content: m.content, created_at: m.created_at, status: m.status || 'stored' };
}

async function handle(req, res, url) {
  url = String(url || req.url || '').split('?')[0];
  if (!url.startsWith('/api/conversations')) return false;
  const user = currentUser(req);
  if (!user) return json(res, 401, { error: 'login required' });
  const userId = user.id;

  if (req.method === 'GET' && url === '/api/conversations') {
    const items = read(CONVERSATIONS, []).filter(c => c.user_id === userId).sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
    return json(res, 200, { conversations: items.map(publicConversation) });
  }

  if (req.method === 'POST' && url === '/api/conversations') {
    const b = await body(req);
    const title = String(b.title || 'New chat').trim().slice(0, 120) || 'New chat';
    const now = new Date().toISOString();
    const c = { id: id('conv'), user_id: userId, title, created_at: now, updated_at: now, message_count: 0 };
    const items = read(CONVERSATIONS, []);
    items.push(c);
    write(CONVERSATIONS, items);
    return json(res, 201, { conversation: publicConversation(c) });
  }

  const match = url.match(/^\/api\/conversations\/([^/]+)(?:\/messages)?$/);
  if (!match) return json(res, 404, { error: 'conversation route not found' });
  const conversationId = match[1];
  const conversation = ownedConversation(userId, conversationId);
  if (!conversation) return json(res, 404, { error: 'conversation not found' });

  if (req.method === 'GET' && url.endsWith('/messages')) {
    const messages = read(MESSAGES, []).filter(m => m.conversation_id === conversationId).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    return json(res, 200, { conversation: publicConversation(conversation), messages: messages.map(publicMessage) });
  }

  if (req.method === 'POST' && url.endsWith('/messages')) {
    const b = await body(req);
    const content = String(b.content || '').trim().slice(0, 12000);
    if (!content) return json(res, 422, { error: 'message content is required' });
    const now = new Date().toISOString();
    const messages = read(MESSAGES, []);
    const userMessage = { id: id('msg'), conversation_id: conversationId, user_id: userId, role: 'user', content, created_at: now, status: 'stored' };
    messages.push(userMessage);
    const response = await DigitalProxyAssistant.reply(content, { user_id: userId, conversation_id: conversationId });
    const assistantMessage = { id: id('msg'), conversation_id: conversationId, user_id: userId, role: 'assistant', content: String(response.reply || ''), created_at: new Date().toISOString(), status: response.status || 'stored' };
    messages.push(assistantMessage);
    write(MESSAGES, messages);
    const conversations = read(CONVERSATIONS, []);
    const stored = conversations.find(c => c.id === conversationId && c.user_id === userId);
    stored.updated_at = assistantMessage.created_at;
    stored.message_count = messages.filter(m => m.conversation_id === conversationId).length;
    if (conversation.title === 'New chat') stored.title = content.slice(0, 60);
    write(CONVERSATIONS, conversations);
    return json(res, 201, { conversation: publicConversation(stored), messages: [publicMessage(userMessage), publicMessage(assistantMessage)] });
  }

  if (req.method === 'PATCH' && url === '/api/conversations/' + conversationId) {
    const b = await body(req);
    const title = String(b.title || '').trim().slice(0, 120);
    if (!title) return json(res, 422, { error: 'title is required' });
    const conversations = read(CONVERSATIONS, []);
    const stored = conversations.find(c => c.id === conversationId && c.user_id === userId);
    stored.title = title;
    stored.updated_at = new Date().toISOString();
    write(CONVERSATIONS, conversations);
    return json(res, 200, { conversation: publicConversation(stored) });
  }

  if (req.method === 'DELETE' && url === '/api/conversations/' + conversationId) {
    write(CONVERSATIONS, read(CONVERSATIONS, []).filter(c => !(c.id === conversationId && c.user_id === userId)));
    write(MESSAGES, read(MESSAGES, []).filter(m => m.conversation_id !== conversationId || m.user_id !== userId));
    return json(res, 200, { ok: true });
  }

  return json(res, 405, { error: 'method not allowed' });
}

module.exports = { handle };
