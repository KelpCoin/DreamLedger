"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const url = require("url");
const PORT = process.env.PORT || 3000;
const STATIC = path.join(__dirname, "frontend");
const STATE_FILE = "./state.json";

function load() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, "utf8")); }
  catch {
    return {
      users:{}, usersByName:{}, sessions:{},
      listings:[], trades:[], escrow:{},
      reputation:{}, cultcoinLedger:[], eventLog:[]
    };
  }
}
function save(s) { fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2)); }

function hash(p) {
  const salt = crypto.randomBytes(16).toString("hex");
  return salt + ":" + crypto.pbkdf2Sync(p, salt, 12000, 64, "sha512").toString("hex");
}
function verify(p, stored) {
  const [s, h] = stored.split(":");
  return crypto.pbkdf2Sync(p, s, 12000, 64, "sha512").toString("hex") === h;
}
function token() { return crypto.randomBytes(32).toString("hex"); }
function getUser(req, s) {
  const m = (req.headers.cookie || "").match(/session=([^;]+)/);
  if (!m) return null;
  const id = s.sessions[m[1]];
  return id ? { id, ...s.users[id] } : null;
}
function logEvent(s, type, payload) {
  s.eventLog.push({ type, payload, ts: Date.now() });
}

const server = http.createServer((req, res) => {
  const u = url.parse(req.url, true);
  const p = u.pathname;
  const m = req.method;
  const s = load();

  // ---------- API ROUTES (ALWAYS FIRST) ----------
  if (p === "/health") {
    res.writeHead(200, {"Content-Type":"application/json"});
    return res.end(JSON.stringify({ok:true}));
  }

  if (p === "/signup" && m === "POST") {
    let b = "";
    req.on("data", c => b += c);
    req.on("end", () => {
      const x = new URLSearchParams(b);
      const name = x.get("username"), pass = x.get("password");
      if (s.usersByName[name]) { res.writeHead(400); return res.end("exists"); }
      const id = crypto.randomUUID();
      const t = token();
      s.users[id] = { name, password: hash(pass) };
      s.usersByName[name] = id;
      s.sessions[t] = id;
      s.reputation[id] = 0;
      save(s);
      res.setHeader("Set-Cookie", `session=${t}; Path=/`);
      res.writeHead(302, { Location: "/" });
      res.end();
    });
    return;
  }

  if (p === "/login" && m === "POST") {
    let b = "";
    req.on("data", c => b += c);
    req.on("end", () => {
      const x = new URLSearchParams(b);
      const name = x.get("username"), pass = x.get("password");
      const id = s.usersByName[name];
      if (!id || !verify(pass, s.users[id].password)) { res.writeHead(401); return res.end("bad"); }
      const t = token();
      s.sessions[t] = id;
      save(s);
      res.setHeader("Set-Cookie", `session=${t}; Path=/`);
      res.writeHead(302, { Location: "/" });
      res.end();
    });
    return;
  }

  // ---------- STATIC FILES (LAST) ----------
  if (m === "GET") {
    let file = p === "/" ? "/index.html" : p;
    const fp = path.join(STATIC, file);
    if (fs.existsSync(fp)) {
      const ext = path.extname(fp);
      const mime = {".html":"text/html",".css":"text/css",".js":"text/javascript"}[ext] || "text/plain";
      res.writeHead(200, {"Content-Type": mime});
      return res.end(fs.readFileSync(fp));
    }
  }

  res.writeHead(404);
  res.end("not found");
});

server.listen(PORT, "0.0.0.0", () => console.log("DreamLedger running on", PORT));
