"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { URLSearchParams } = require("url");

const PORT = process.env.PORT || 3000;
const STATIC = path.join(__dirname, "frontend");
const STATE_FILE = "./state.json";

function loadState() {
    try { return JSON.parse(fs.readFileSync(STATE_FILE, "utf8")); } catch (_) {
        return { users: {}, usersByEmail: {}, sessions: {} };
    }
}
function saveState(s) {
    fs.writeFileSync(STATE_FILE + ".tmp", JSON.stringify(s, null, 2));
    fs.renameSync(STATE_FILE + ".tmp", STATE_FILE);
}

let queue = Promise.resolve();
function withState(fn) {
    queue = queue.then(async () => {
        const state = loadState();
        await fn(state);
        saveState(state);
    }).catch(console.error);
    return queue;
}

function hashPassword(pass) {
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto.pbkdf2Sync(pass, salt, 10000, 64, "sha512").toString("hex");
    return `${salt}:${hash}`;
}
function verifyPassword(pass, stored) {
    const [salt, hash] = stored.split(":");
    return crypto.pbkdf2Sync(pass, salt, 10000, 64, "sha512").toString("hex") === hash;
}
function generateToken() { return crypto.randomBytes(32).toString("hex"); }
function getSessionUser(req, state) {
    const m = (req.headers.cookie || "").match(/session=([^;]+)/);
    if (!m) return null;
    const uid = state.sessions[m[1]];
    return uid ? state.users[uid] : null;
}

const server = http.createServer(async (req, res) => {
    const method = req.method.toUpperCase();
    const url = new URL(req.url, "http://localhost");
    const pathname = url.pathname;

    // 1. Static files for GET
    if (method === "GET") {
        const safe = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, "");
        const filePath = path.join(STATIC, safe === "/" ? "index.html" : safe);
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            res.writeHead(200, { "Content-Type": "text/html" });
            res.end(fs.readFileSync(filePath));
            return;
        }
    }

    // 2. Health
    if (pathname === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
        return;
    }

    // 3. Signup
    if (pathname === "/signup" && method === "POST") {
        let body = "";
        req.on("data", c => body += c);
        req.on("end", async () => {
            const params = new URLSearchParams(body);
            const username = params.get("username");
            const password = params.get("password");
            if (!username || !password) { res.writeHead(400); res.end(); return; }
            try {
                await withState((state) => {
                    if (state.usersByEmail[username]) throw new Error("exists");
                    const id = crypto.randomUUID();
                    state.users[id] = { email: username, passwordHash: hashPassword(password) };
                    state.usersByEmail[username] = id;
                    const token = generateToken();
                    state.sessions[token] = id;
                    res.setHeader("Set-Cookie", `session=${token}; Path=/; HttpOnly`);
                    res.writeHead(302, { Location: "/" });
                    res.end();
                });
            } catch (e) { res.writeHead(409); res.end(e.message); }
        });
        return;
    }

    // 4. Login
    if (pathname === "/login" && method === "POST") {
        let body = "";
        req.on("data", c => body += c);
        req.on("end", async () => {
            const params = new URLSearchParams(body);
            const username = params.get("username");
            const password = params.get("password");
            if (!username || !password) { res.writeHead(400); res.end(); return; }
            try {
                await withState((state) => {
                    const id = state.usersByEmail[username];
                    if (!id || !verifyPassword(password, state.users[id].passwordHash)) throw new Error("bad");
                    const token = generateToken();
                    state.sessions[token] = id;
                    res.setHeader("Set-Cookie", `session=${token}; Path=/; HttpOnly`);
                    res.writeHead(302, { Location: "/" });
                    res.end();
                });
            } catch (e) { res.writeHead(401); res.end(e.message); }
        });
        return;
    }

    // 5. Logout
    if (pathname === "/logout") {
        const m = (req.headers.cookie || "").match(/session=([^;]+)/);
        if (m) await withState((s) => { delete s.sessions[m[1]]; });
        res.setHeader("Set-Cookie", "session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT");
        res.writeHead(302, { Location: "/" });
        res.end();
        return;
    }

    // 6. Profile
    if (pathname === "/profile") {
        const state = loadState();
        const user = getSessionUser(req, state);
        if (!user) { res.writeHead(302, { Location: "/login" }); res.end(); return; }
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(`<!DOCTYPE html><html><head><title>Profile</title></head><body><h1>Your Profile</h1><p>${user.email}</p><a href="/logout">Logout</a> | <a href="/">Home</a></body></html>`);
        return;
    }

    res.writeHead(404);
    res.end("Not Found");
});

server.listen(PORT, "0.0.0.0", () => console.log("DreamLedger on", PORT));
